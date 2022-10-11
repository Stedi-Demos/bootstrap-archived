import dotenv from "dotenv";

import { UpdateBucketCommand, UpdateBucketInput } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../lib/buckets.js";
import { requiredEnvVar } from "../lib/environment.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";

dotenv.config({ override: true });

(async () => {
  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const executionsBucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");

  if (sftpBucketName === executionsBucketName) {
    throw new Error("Error: SFTP_BUCKET_NAME and EXECUTIONS_BUCKET_NAME env vars must not point to the same bucket");
  }

  const functionPaths = getFunctionPaths("read");
  if (functionPaths.length != 1) {
    throw new Error("Error: expected to find exactly 1 `read` function");
  }

  const functionName = functionNameFromPath(functionPaths[0]);

  const enableBucketNotificationsArgs: UpdateBucketInput = {
    bucketName: sftpBucketName,
    notifications: {
      functions: [{ functionName }],
    }
  }

  await bucketClient().send(new UpdateBucketCommand(enableBucketNotificationsArgs));
})();