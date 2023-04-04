import hash from "object-hash";
import { TextEncoder } from "util";
import { ErrorObject, serializeError } from "serialize-error";

import {
  BucketsClient,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@stedi/sdk-client-buckets";
import { requiredEnvVar } from "./environment.js";
import { ErrorWithContext } from "./errorWithContext.js";
import { bucketsClient } from "./clients/buckets.js";
import { loadExecutionErrorDestinations } from "./loadExecutionErrorDestinations.js";
import {
  processDeliveries,
  ProcessDeliveriesInput,
} from "./deliveryManager.js";

const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");

let _executionsBucketClient: BucketsClient | undefined;

export interface FailureRecord {
  bucketName?: string;
  key: string;
}
export interface FailureResponse {
  statusCode: number;
  message: string;
  failureRecord: FailureRecord;
  error: ErrorObject;
}

export const recordNewExecution = async (
  executionId: string,
  input: unknown
) => {
  const client = executionsBucketClient();
  const result = await client.send(
    new PutObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
      body: new TextEncoder().encode(JSON.stringify(input)),
    })
  );

  console.log({ action: "recordNewExecution", executionId, result });
};

export const markExecutionAsSuccessful = async (executionId: string) => {
  const client = executionsBucketClient();
  const inputResult = await client.send(
    new DeleteObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
    })
  );

  console.log({
    action: "markExecutionAsSuccessful",
    executionId,
    inputResult,
  });

  // async invokes automatically retries on failure, so
  // we should attempt to cleanup any leftover failure results
  // as this might be a later retry invoke
  const previousFailure = await client.send(
    new DeleteObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/failure.json`,
    })
  );

  console.log({
    action: "markExecutionAsSuccessful",
    executionId,
    previousFailure,
  });

  return { inputResult, previousFailure };
};

export const failedExecution = async (
  executionId: string,
  errorWithContext: ErrorWithContext
): Promise<FailureResponse> => {
  const rawError = serializeError(errorWithContext);
  const failureRecord = await markExecutionAsFailed(executionId, rawError);

  const statusCode: number =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    ((errorWithContext as any)?.$metadata?.httpStatusCode as number) || 500;
  const message = "execution failed";
  const failureResponse = {
    statusCode,
    message,
    failureRecord,
    error: rawError,
  };
  try {
    await sendFailureToDestinations(failureResponse, executionId);
  } catch (e) {
    await markExecutionAsFailed(
      executionId,
      serializeError(e),
      `failure-error-destination.json`
    );
  }
  throw new ErrorWithContext(message, { rawError });
};

const markExecutionAsFailed = async (
  executionId: string,
  error: ErrorObject,
  objectKey = "failure.json"
): Promise<FailureRecord> => {
  const client = executionsBucketClient();
  const key = `functions/${functionName()}/${executionId}/${objectKey}`;
  const result = await client.send(
    new PutObjectCommand({
      bucketName,
      key,
      body: new TextEncoder().encode(JSON.stringify(error)),
    })
  );

  console.log({
    action: "markExecutionAsFailed",
    executionId,
    result,
    error: JSON.stringify(error),
  });

  return { bucketName, key };
};

export const generateExecutionId = (event: unknown) =>
  hash({
    functionName: functionName(),
    event,
  });

// Used inside error path, do not throw
export const sendFailureToDestinations = async (
  failure: FailureResponse,
  executionId: string
): Promise<void> => {
  const errorDestinations = await loadExecutionErrorDestinations();

  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations: errorDestinations.destinations,
    payload: failure,
    destinationFilename: `${executionId}-${new Date().toUTCString()}`,
  };

  await processDeliveries(processDeliveriesInput);
};

const functionName = () => requiredEnvVar("STEDI_FUNCTION_NAME");

const executionsBucketClient = (): BucketsClient => {
  if (_executionsBucketClient === undefined) {
    _executionsBucketClient = bucketsClient();
  }

  return _executionsBucketClient;
};
