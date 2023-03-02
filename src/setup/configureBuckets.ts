import dotenv from "dotenv";
import { CreateUserCommand, DeleteUserCommand } from "@stedi/sdk-client-sftp";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
} from "@stedi/sdk-client-buckets";

import { updateDotEnvFile } from "../support/utils.js";
import { updateResourceMetadata } from "../support/bootstrapMetadata.js";
import { bucketsClient } from "../lib/clients/buckets.js";
import { sftpClient } from "../lib/clients/sftp.js";

const buckets = bucketsClient();
const sftp = sftpClient();

(async () => {
  console.log("Configuring buckets...");

  // Creating a new SFTP user pre-provisions the SFTP bucket and necessary permissions

  const user = await sftp.send(
    new CreateUserCommand({
      description: "Temp user to get bucket name",
      homeDirectory: "/_stedi/void",
    })
  );

  if (!user.bucketName) throw new Error("ftp bucket name not found");

  // Pre-create trading partner inbound/outbound directories for convenience
  const tradingPartnerPrefix = "trading_partners/ANOTHERMERCH";
  const tradingPartnerDirectories = [
    `${tradingPartnerPrefix}/inbound/`,
    `${tradingPartnerPrefix}/outbound/`,
  ];
  for await (const key of tradingPartnerDirectories) {
    await buckets.send(
      new PutObjectCommand({
        bucketName: user.bucketName,
        key,
        body: new Uint8Array(),
      })
    );
  }

  // Use a separate bucket for tracking function executions
  const stediAccountId = user.bucketName.split("-sftp")[0];
  const executionsBucketName = `${stediAccountId}-executions`;

  const bucketsList = await buckets.send(new ListBucketsCommand({}));
  if (
    !bucketsList.items?.some(
      (bucket) => bucket.bucketName === executionsBucketName
    )
  ) {
    buckets.send(
      new CreateBucketCommand({
        bucketName: executionsBucketName,
      })
    );
  }

  const bucketEnvVarEntries: dotenv.DotenvParseOutput = {
    ["SFTP_BUCKET_NAME"]: user.bucketName,
    ["EXECUTIONS_BUCKET_NAME"]: executionsBucketName,
  };

  const existingEnvVars = dotenv.config().parsed ?? {};
  updateDotEnvFile({
    ...existingEnvVars,
    ...bucketEnvVarEntries,
  });

  await updateResourceMetadata(bucketEnvVarEntries);

  // Clean up temporary user and corresponding home directory
  await sftp.send(new DeleteUserCommand({ username: user.username }));
  await buckets.send(
    new DeleteObjectCommand({
      bucketName: user.bucketName,
      key: user.homeDirectory,
    })
  );
})();
