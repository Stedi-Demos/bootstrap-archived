import {
  ReadBucketCommand,
  UpdateBucketCommand,
  UpdateBucketInput,
} from "@stedi/sdk-client-buckets";
import { bucketsClient } from "../lib/clients/buckets.js";

import { requiredEnvVar } from "../lib/environment.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";

const buckets = bucketsClient();

(async () => {
  const sftpBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
  const executionsBucketName = requiredEnvVar("EXECUTIONS_BUCKET_NAME");

  if (sftpBucketName === executionsBucketName) {
    throw new Error(
      "Error: SFTP_BUCKET_NAME and EXECUTIONS_BUCKET_NAME env vars must not point to the same bucket"
    );
  }

  const functionPaths = getFunctionPaths("inbound");
  if (functionPaths.length != 1) {
    throw new Error("Error: expected to find exactly 1 `inbound` function");
  }

  const functionName = functionNameFromPath(functionPaths[0]);

  const existingBucketConfig = await buckets.send(
    new ReadBucketCommand({
      bucketName: sftpBucketName,
    })
  );

  const currentNotificationFunctionCount =
    existingBucketConfig?.notifications?.functions?.length || 0;

  if (currentNotificationFunctionCount !== 0) {
    const notificationFunctionNames =
      existingBucketConfig?.notifications?.functions?.map(
        (fn) => fn.functionName
      );
    const bucketNotificationListOutput = JSON.stringify(
      notificationFunctionNames
    );
    console.log(
      `Bucket notifications already enabled for ${sftpBucketName}: ${bucketNotificationListOutput}. Skipping.`
    );
    return;
  }

  const enableBucketNotificationsArgs: UpdateBucketInput = {
    bucketName: sftpBucketName,
    notifications: {
      functions: [{ functionName }],
    },
  };

  await buckets.send(new UpdateBucketCommand(enableBucketNotificationsArgs));

  console.log(`\nDone.`);
  console.log(
    `Enabled bucket notifications for ${sftpBucketName} to invoke ${functionName} function`
  );
})();
