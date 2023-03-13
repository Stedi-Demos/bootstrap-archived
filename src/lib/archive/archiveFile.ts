import { PutObjectCommand } from "@stedi/sdk-client-buckets";
import { bucketsClient } from "../clients/buckets.js";
import { requiredEnvVar } from "../environment.js";
import { buildArchivalPath } from "./buildArchivalPath.js";

const buckets = bucketsClient();

export const archiveFile = async ({
  currentKey,
  body,
}: {
  currentKey: string;
  body: string;
}) => {
  const key = buildArchivalPath({ currentKey });

  await buckets.send(
    new PutObjectCommand({
      bucketName: requiredEnvVar("EXECUTIONS_BUCKET_NAME"),
      key,
      body: Buffer.from(body),
    })
  );
};
