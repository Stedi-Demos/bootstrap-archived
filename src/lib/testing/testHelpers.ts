import { As2Client } from "@stedi/sdk-client-as2";
import {
  BucketsClient,
  DeleteObjectCommand,
  PutObjectCommand,
  ReadBucketCommand,
} from "@stedi/sdk-client-buckets";
import { EDITranslateClient } from "@stedi/sdk-client-edi-translate";
import { FunctionsClient } from "@stedi/sdk-client-functions";
import { GuidesClient } from "@stedi/sdk-client-guides";
import { StashClient } from "@stedi/sdk-client-stash";
import { mockClient } from "aws-sdk-client-mock";

const executionsBucket = process.env["EXECUTIONS_BUCKET_NAME"] ?? "";

/**
 * Creates a mocked Stedi As2Client
 *
 * @returns a mocked As2Client
 */
export const mockAs2Client = () => {
  return mockClient(As2Client);
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
    .on(PutObjectCommand, { bucketName: executionsBucket }) // execution creation
    .resolvesOnce({})
    .on(DeleteObjectCommand, { bucketName: executionsBucket }) // execution cleanup
    .resolvesOnce({})
    .on(ReadBucketCommand, { bucketName: executionsBucket }) // infinite loop check
    .resolvesOnce({
      notifications: {
        functions: [],
      },
    });
};

/**
 * Creates a mocked Stedi FunctionsClient
 *
 * @returns a mocked FunctionsClient
 */
export const mockFunctionsClient = () => {
  return mockClient(FunctionsClient);
};

/**
 * Creates a mocked Stedi StashClient
 *
 * @returns a mocked StashClient
 */
export const mockStashClient = () => {
  return mockClient(StashClient);
};

/**
 * Creates a mocked Stedi TranslateClient
 *
 * @returns a mocked TranslateClient
 */
export const mockTranslateClient = () => {
  return mockClient(EDITranslateClient);
};

/**
 * Creates a mocked Stedi GuidesClient
 *
 * @returns a mocked GuidesClient
 */
export const mockGuideClient = () => {
  return mockClient(GuidesClient);
};
