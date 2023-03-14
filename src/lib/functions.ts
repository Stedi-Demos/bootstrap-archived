import { DocumentType } from "@aws-sdk/types";
import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import {
  CreateFunctionCommand,
  CreateFunctionCommandOutput,
  DeleteFunctionCommand,
  DeleteFunctionCommandOutput,
  InvokeFunctionCommand,
  UpdateFunctionCommand,
  UpdateFunctionCommandOutput,
} from "@stedi/sdk-client-functions";
import { bucketsClient } from "./clients/buckets.js";
import { functionsClient } from "./clients/functions.js";
import { requiredEnvVar } from "./environment.js";

const functions = functionsClient();
const buckets = bucketsClient();

type FunctionInvocationId = string;

export const invokeFunction = async (
  functionName: string,
  input: DocumentType
): Promise<DocumentType | undefined> => {
  const result = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      payload: input,
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
