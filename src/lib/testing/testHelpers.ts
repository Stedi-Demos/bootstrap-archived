import {
  BucketsClient,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@stedi/sdk-client-buckets";
import { StashClient } from "@stedi/sdk-client-stash";
import { mockClient } from "aws-sdk-client-mock";
import nock from "nock";
import { requiredEnvVar } from "../environment.js";

const executionsBucket = requiredEnvVar("EXECUTIONS_BUCKET_NAME") ?? "";

/**
 * Mocks all calls to Axiom
 *
 * @param doNotMockLogMessages - array of message strings to EXCLUDE from mock
 */
export const mockLogging = (doNotMockLogMessages: string[] = []) => {
  // mock logging calls
  nock(/https:\/\/cloud.axiom.co/)
    .post(/\/api\/v1\/datasets\/.*/, (body) => {
      const willMock = !doNotMockLogMessages.includes(body.message);
      // console.log({ willMock });
      return willMock;
    })
    .reply(200, { info: 0 })
    .persist();
};

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
