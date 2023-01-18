import {
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
} from "@stedi/sdk-client-buckets";
import { bucketClient } from "../lib/buckets.js";
import { guidesClient } from "../support/guide.js";
import { stashClient } from "../lib/stash.js";
import { DeleteGuideCommand } from "@stedi/sdk-client-guides";
import {
  PARTNERS_KEYSPACE_NAME,
  CONTROL_NUMBER_KEYSPACE_NAME,
} from "../lib/constants.js";
import { DeleteKeyspaceCommand } from "@stedi/sdk-client-stash";
import * as dotenv from "dotenv";
import { DeleteUserCommand } from "@stedi/sdk-client-sftp";
import { sftpClient } from "../lib/sftp.js";
import { functionClient } from "../support/functions.js";
import { DeleteFunctionCommand } from "@stedi/sdk-client-functions";
import { updateDotEnvFile } from "../support/utils.js";
dotenv.config();

(async () => {
  console.log("Deleting all resources provisioned by bootstrap");

  // Delete Buckets
  console.log("Deleting Buckets");
  await emptyAndDeleteBucket(process.env.SFTP_BUCKET_NAME ?? "");
  await emptyAndDeleteBucket(process.env.EXECUTIONS_BUCKET_NAME ?? "");

  // Delete Guides
  console.log("Deleting Guides");
  const guideIds = process.env.GUIDE_IDS?.split(",");
  for (const guideId of guideIds ?? []) {
    await guidesClient().send(
      new DeleteGuideCommand({ id: `LIVE_${guideId}` })
    );
    await guidesClient().send(
      new DeleteGuideCommand({ id: `DRFT_${guideId}` })
    );
  }

  // Delete Stash keyspaces
  console.log("Deleting Stash Keyspaces");
  await stashClient().send(
    new DeleteKeyspaceCommand({ keyspaceName: PARTNERS_KEYSPACE_NAME })
  );
  await stashClient().send(
    new DeleteKeyspaceCommand({ keyspaceName: CONTROL_NUMBER_KEYSPACE_NAME })
  );

  // Delete SFTP Users
  console.log("Deleting SFTP Users");
  await sftpClient().send(
    new DeleteUserCommand({ username: process.env.SFTP_USER ?? "" })
  );

  // Delete Functions
  console.log("Deleting Functions");
  await functionClient().send(
    new DeleteFunctionCommand({ functionName: "edi-inbound" })
  );
  await functionClient().send(
    new DeleteFunctionCommand({ functionName: "edi-outbound" })
  );

  // Removing env variables
  console.log("Removing env variables");
  const existingEnvVars = dotenv.config().parsed ?? {};
  delete existingEnvVars.SFTP_BUCKET_NAME;
  delete existingEnvVars.EXECUTIONS_BUCKET_NAME;
  delete existingEnvVars.GUIDE_IDS;
  delete existingEnvVars.SFTP_USER;

  updateDotEnvFile({ ...existingEnvVars });

  console.log("Done");
})();

async function emptyAndDeleteBucket(bucketName: string) {
  const client = await bucketClient();

  const res = await client.send(new ListObjectsCommand({ bucketName }));
  for (const item of res.items ?? []) {
    await client.send(new DeleteObjectCommand({ bucketName, key: item.key }));
  }
  await client.send(new DeleteBucketCommand({ bucketName }));
}
