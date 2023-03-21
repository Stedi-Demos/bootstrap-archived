import { DocumentType } from "@aws-sdk/types";
import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import {
  CreateFunctionCommand,
  CreateFunctionCommandOutput,
  DeleteFunctionCommand,
  DeleteFunctionCommandOutput,
  InvocationType,
  InvokeFunctionCommand,
  UpdateFunctionCommand,
  UpdateFunctionCommandOutput,
} from "@stedi/sdk-client-functions";
import { bucketsClient } from "./clients/buckets.js";
import { functionsClient } from "./clients/functions.js";
import { requiredEnvVar } from "./environment.js";
import {
  CreateEventToFunctionBindingCommand,
  Events,
  UpdateEventToFunctionBindingCommand,
  waitUntilEventToFunctionBindingCreateComplete,
} from "@stedi/sdk-client-events";
import { eventsClient } from "./clients/events.js";

const functions = functionsClient();
const buckets = bucketsClient();
const events = eventsClient();

export const invokeFunction = async (
  functionName: string,
  input: DocumentType,
  invocationType = InvocationType.SYNCHRONOUS
): Promise<DocumentType | undefined> => {
  const result = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      payload: input,
      invocationType,
    })
  );

  return result.payload;
};

export const createFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
): Promise<CreateFunctionCommandOutput> => {
  const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");
  const key = `functionPackages/${functionName}/${new Date()
    .getTime()
    .toString()}-package.zip`;

  await buckets.send(
    new PutObjectCommand({
      bucketName,
      key,
      body: functionPackage,
    }) as any //SDK mismatches
  );

  return functions.send(
    new CreateFunctionCommand({
      functionName,
      packageBucket: bucketName,
      packageKey: key,
      environmentVariables,

      timeout: 900,
    })
  );
};

export const updateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
): Promise<UpdateFunctionCommandOutput> => {
  const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");
  const key = `functionPackages/${functionName}/${new Date()
    .getTime()
    .toString()}-package.zip`;

  await buckets.send(
    new PutObjectCommand({
      bucketName,
      key,
      body: functionPackage,
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
