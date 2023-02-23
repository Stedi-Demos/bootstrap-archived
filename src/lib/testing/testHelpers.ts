import {
  BucketsClient,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@stedi/sdk-client-buckets";
import { StashClient } from "@stedi/sdk-client-stash";
import { mockClient } from "aws-sdk-client-mock";
import { translateClient } from "../translateV3.js";

const executionsBucket = process.env["EXECUTIONS_BUCKET_NAME"] ?? "";

/**
 * Creates a mocked Stedi BucketsClient
 *
 * @returns a mocked BucketsClient
 */
export const mockBucketClient = () => {
  return mockClient(BucketsClient);
};

/**
 * Adds happy path commands for function execution tracking. (PUT and DELETE)
 */
export const mockExecutionTracking = (mockedClient = mockBucketClient()) => {
  // mock bucket calls for execution tracking
  return mockedClient
    .on(PutObjectCommand, { bucketName: executionsBucket })
    .resolves({})
    .on(DeleteObjectCommand, { bucketName: executionsBucket })
    .resolves({});
};

/**
 * Creates a mocked Stedi StashClient
 *
 * @returns a mocked StashClient
 */
export const mockStashClient = () => {
  return mockClient(StashClient);
};

export const mockTranslateClient = () => {
  return mockClient(translateClient());
};
