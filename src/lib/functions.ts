import { DocumentType } from "@aws-sdk/types";
import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import {
  CreateFunctionCommand,
  CreateFunctionCommandOutput,
  DeleteFunctionCommand,
  DeleteFunctionCommandOutput,
  InvocationType,
  InvokeFunctionCommand,
  LogRetention,
  UpdateFunctionCommand,
  UpdateFunctionCommandOutput,
  waitUntilFunctionCreateComplete,
} from "@stedi/sdk-client-functions";
import { bucketsClient } from "./clients/buckets.js";
import { functionsClient } from "./clients/functions.js";
import { requiredEnvVar } from "./environment.js";
import {
  CreateEventToFunctionBindingCommand,
  UpdateEventToFunctionBindingCommand,
  waitUntilEventToFunctionBindingCreateComplete,
} from "@stedi/sdk-client-events";
import { eventsClient } from "./clients/events.js";
import { ErrorWithContext } from "./errorWithContext.js";
import { compile, packForDeployment } from "../support/compile.js";
import dotenv from "dotenv";
import { maxWaitTime } from "../support/contants.js";

const functions = functionsClient();
const buckets = bucketsClient();
const events = eventsClient();

export const invokeFunction = async (
  functionName: string,
  input: unknown,
  invocationType = InvocationType.SYNCHRONOUS
): Promise<DocumentType | undefined> => {
  const result = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      payload: input as DocumentType,
      invocationType,
    })
  );

  if (result.error) {
    throw new ErrorWithContext("function invocation error", {
      result,
    });
  }

  return result.payload;
};

export const createFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: Record<string, string>
): Promise<CreateFunctionCommandOutput> => {
  const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");
  const key = `functionPackages/${functionName}/${new Date()
    .getTime()
    .toString()}-package.zip`;

  await buckets.send(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new PutObjectCommand({
      bucketName,
      key,
      body: functionPackage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any //SDK mismatches
  );

  return functions.send(
    new CreateFunctionCommand({
      functionName,
      packageBucket: bucketName,
      packageKey: key,
      environmentVariables,
      logRetention: LogRetention.THREE_MONTHS,
      timeout: 900,
    })
  );
};

export const updateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: Record<string, string>
): Promise<UpdateFunctionCommandOutput> => {
  const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");
  const key = `functionPackages/${functionName}/${new Date()
    .getTime()
    .toString()}-package.zip`;

  await buckets.send(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    new PutObjectCommand({
      bucketName,
      key,
      body: functionPackage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any //SDK mismatches
  );

  return functions.send(
    new UpdateFunctionCommand({
      functionName,
      packageBucket: bucketName,
      packageKey: key,
      environmentVariables,
      timeout: 900,
    })
  );
};

export const deleteFunction = async (
  functionName: string
): Promise<DeleteFunctionCommandOutput> => {
  return functions.send(
    new DeleteFunctionCommand({
      functionName,
    })
  );
};

export const createFunctionEventBinding = async (
  functionName: string,
  eventPattern: DocumentType,
  eventToFunctionBindingName: string
) => {
  return events.send(
    new CreateEventToFunctionBindingCommand({
      eventPattern,
      functionName,
      eventToFunctionBindingName,
    })
  );
};

export const updateFunctionEventBinding = async (
  functionName: string,
  eventPattern: DocumentType,
  eventToFunctionBindingName: string
) => {
  return events.send(
    new UpdateEventToFunctionBindingCommand({
      eventPattern,
      functionName,
      eventToFunctionBindingName,
    })
  );
};

export const deployFunctionAtPath = async (
  path: `./src/${string}/handler.ts`,
  name?: string
) => {
  const functionName = name ?? path.split("/").slice(-3, -1).join("-");
  const jsPath = await compile(path);
  const code = await packForDeployment(jsPath);

  try {
    const functionPackage = new Uint8Array(code);
    const environmentVariables = dotenv.config().parsed ?? {};
    environmentVariables.NODE_OPTIONS = "--enable-source-maps";
    environmentVariables.STEDI_FUNCTION_NAME = functionName;

    await createOrUpdateFunction(
      functionName,
      functionPackage,
      environmentVariables
    );

    await waitUntilFunctionCreateComplete(
      { client: functions, maxWaitTime },
      { functionName }
    );
    console.log(`Finished deploying function: ${functionName}`);
  } catch (e) {
    console.error(
      `Could not update deploy ${functionName}. Error: ${JSON.stringify(
        e,
        null,
        2
      )}`
    );
  }

  return functionName;
};

export const createOrUpdateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: Record<string, string>
) => {
  try {
    await updateFunction(functionName, functionPackage, environmentVariables);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      await createFunction(functionName, functionPackage, environmentVariables);
    else throw error;
  }
};

export const createOrUpdateEventBinding = async (
  functionName: string,
  eventPattern: DocumentType,
  bindingName: string
) => {
  try {
    await updateFunctionEventBinding(functionName, eventPattern, bindingName);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      await createFunctionEventBinding(functionName, eventPattern, bindingName);
    else throw error;
  }
};

export const deployEventBinding = async (
  functionName: string,
  eventPattern: DocumentType,
  bindingName: string
) => {
  await createOrUpdateEventBinding(functionName, eventPattern, bindingName);

  await waitUntilEventToFunctionBindingCreateComplete(
    { client: eventsClient(), maxWaitTime },
    { eventToFunctionBindingName: bindingName }
  );
  console.log(`Finished deploying event binding: ${bindingName}`);
};
