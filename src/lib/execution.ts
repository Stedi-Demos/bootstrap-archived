import hash from "object-hash";
import { TextEncoder } from "util";
import { ErrorObject, serializeError } from "serialize-error";

import {
  BucketsClient,
  DeleteObjectCommand,
  PutObjectCommand,
  ReadBucketCommand,
} from "@stedi/sdk-client-buckets";
import { requiredEnvVar } from "./environment.js";
import { ErrorWithContext } from "./errorWithContext.js";
import { bucketsClient } from "./clients/buckets.js";
import fetch from "node-fetch";

const bucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");
const slackEndPoint = requiredEnvVar("SLACK_ENDPOINT");
const stediApiKey = requiredEnvVar("STEDI_API_KEY");

let _executionsBucketClient: BucketsClient;
let _infiniteLoopCheckPassed: boolean = false;

export type FailureRecord = { bucketName?: string; key: string };
export type FailureResponse = {
  statusCode: number;
  message: string;
  failureRecord: FailureRecord;
  error: ErrorObject;
};

export const recordNewExecution = async (executionId: string, input: any) => {
  const client = await executionsBucketClient();
  const result = await client.send(
    new PutObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
      body: new TextEncoder().encode(JSON.stringify(input)),
    })
  );
  if (result)
    console.log({ action: "recordNewExecution", executionId, result });
};

export const markExecutionAsSuccessful = async (executionId: string) => {
  const client = await executionsBucketClient();
  const inputResult = await client.send(
    new DeleteObjectCommand({
      bucketName,
      key: `functions/${functionName()}/${executionId}/input.json`,
    })
  );

  if (inputResult)
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

  if (previousFailure)
    console.log({
      action: "markExecutionAsSuccessful",
      executionId,
      previousFailure,
    });
  return { inputResult, previousFailure };
};

export class PostToSlack {
  constructor(
    message: string,
    type: "Success" | "Failure" | "Info" | "Warning" = "Failure",
    customer = "FMXCHEP"
  ) {
    this.Type = type;
    this.Customer = customer;
    this.Message = message;
  }
  public Type: "Success" | "Failure" | "Info" | "Warning";
  public Customer: string;
  public Message: string;
}

const notifySlack = async (message: string[]): Promise<void> => {
  const body = new PostToSlack(message.filter(s => s == "").join("\n "));

  const response = await fetch(slackEndPoint, {
    method: "post",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: "Key " + stediApiKey,
    },
  });
  const data = await response.json();
  console.log("Tried to notify Slack:", data);
};

export const failedExecution = async (
  executionId: string,
  errorWithContext: ErrorWithContext
): Promise<FailureResponse> => {
  const rawError = serializeError(errorWithContext);
  const failureRecord = await markExecutionAsFailed(executionId, rawError);
  const statusCode =
    (errorWithContext as any)?.["$metadata"]?.httpStatusCode || 500;
  const message = "execution failed";
  await notifySlack([message, rawError.message ?? "", rawError.name ?? ""]);
  return { statusCode, message, failureRecord, error: rawError };
};

const markExecutionAsFailed = async (
  executionId: string,
  error: ErrorObject
): Promise<FailureRecord> => {
  const client = await executionsBucketClient();
  const key = `functions/${functionName()}/${executionId}/failure.json`;
  const result = await client.send(
    new PutObjectCommand({
      bucketName,
      key,
      body: new TextEncoder().encode(JSON.stringify(error)),
    })
  );

  if (result)
    console.log({ action: "markExecutionAsFailed", executionId, result });

  return { bucketName, key };
};

export const generateExecutionId = (event: any) =>
  hash({
    functionName: functionName(),
    event,
  });

const functionName = () => requiredEnvVar("STEDI_FUNCTION_NAME");

const executionsBucketClient = async (): Promise<BucketsClient> => {
  if (_executionsBucketClient === undefined) {
    _executionsBucketClient = bucketsClient();
  }

  if (!_infiniteLoopCheckPassed) {
    // guard against infinite Function execution loops
    const executionsBucket = await _executionsBucketClient.send(
      new ReadBucketCommand({ bucketName })
    );
    if (
      executionsBucket.notifications?.functions?.some(
        (fn) => fn.functionName === functionName()
      )
    ) {
      throw new Error(
        "Error: executions bucket has recursive notifications configured"
      );
    }
    _infiniteLoopCheckPassed = true;
  }

  return _executionsBucketClient;
};
