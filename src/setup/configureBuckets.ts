import dotenv from "dotenv";

import {
  SftpClient,
  CreateUserCommand,
  DeleteUserCommand,
} from "@stedi/sdk-client-sftp";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  ListBucketsCommand,
  PutObjectCommand,
} from "@stedi/sdk-client-buckets";

import { bucketClient } from "../lib/buckets.js";
import { printResourceEnvVarSummary, updateDotEnvFile } from "../support/utils.js";

dotenv.config({ override: true });

(async () => {
  const sftpClient = new SftpClient({
    region: "us-east-1",
    endpoint: "https://api.sftp.us.stedi.com/2022-04-01",
    apiKey: process.env.STEDI_API_KEY,
  });

  // Creating a new SFTP user pre-provisions the SFTP bucket and necessary permissions
  const user = await sftpClient.send(
    new CreateUserCommand({
      description: "Temp user to get bucket name",
      homeDirectory: "/_stedi/void",
    })
  );

  if (!user.bucketName) throw new Error("ftp bucket name not found");

  // Pre-create trading partner inbound/outbound directories for convenience
  const tradingPartnerPrefix = "trading_partners/ANOTHERMERCH";
  const tradingPartnerDirectories = [`${tradingPartnerPrefix}/inbound/`, `${tradingPartnerPrefix}/outbound/`];
  for await(const key of tradingPartnerDirectories) {
    await bucketClient().send(new PutObjectCommand({
      bucketName: user.bucketName,
      key,
      body: undefined,
    }));
  }

  // Use a separate bucket for tracking function executions
  const stediAccountId = user.bucketName.split("-sftp")[0];
  const executionsBucketName = `${stediAccountId}-executions`;

  const bucketsList = await bucketClient().send(new ListBucketsCommand({}));
  if (!bucketsList.items?.some((bucket) => bucket.bucketName === executionsBucketName)) {
    bucketClient().send(new CreateBucketCommand({
      bucketName: executionsBucketName,
    }));
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

  console.log(`\nDone.`);
  printResourceEnvVarSummary("bucket", bucketEnvVarEntries);

  // Clean up temporary user and corresponding home directory
  await sftpClient.send(new DeleteUserCommand({username: user.username}));
  await bucketClient().send(new DeleteObjectCommand({
    bucketName: user.bucketName,
    key: user.homeDirectory,
  }));
})();
