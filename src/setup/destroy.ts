import { DeleteBucketCommand } from "@stedi/sdk-client-buckets";
import { bucketClient, emptyBucket } from "../lib/buckets.js";
import { guidesClient } from "../support/guide.js";
import { stashClient } from "../lib/stash.js";
import { DeleteGuideCommand } from "@stedi/sdk-client-guides";
import {
  PARTNERS_KEYSPACE_NAME,
  CONTROL_NUMBER_KEYSPACE_NAME,
} from "../lib/constants.js";
import {
  DeleteKeyspaceCommand,
  GetValueCommand,
} from "@stedi/sdk-client-stash";
import { functionClient } from "../support/functions.js";
import { DeleteFunctionCommand } from "@stedi/sdk-client-functions";
import { BootstrapMetadataSchema } from "../lib/types/BootstrapMetadata.js";

(async () => {
  console.log("Deleting all resources provisioned by bootstrap");

  // get metadata from stash
  const bootstrapMetadata = await stashClient().send(
    new GetValueCommand({
      keyspaceName: "partners-configuration",
      key: "bootstrap|metadata",
    })
  );
  const { resources } = BootstrapMetadataSchema.parse(bootstrapMetadata.value);

  // Delete Buckets
  console.log("Deleting Buckets");
  await emptyAndDeleteBucket(resources.SFTP_BUCKET_NAME ?? "");
  await emptyAndDeleteBucket(resources.EXECUTIONS_BUCKET_NAME ?? "");

  // Delete Guides
  console.log("Deleting Guides");
  for (const guideId of resources.GUIDE_IDS ?? []) {
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

  // Delete Functions
  console.log("Deleting Functions");
  await functionClient().send(
    new DeleteFunctionCommand({ functionName: "edi-inbound" })
  );
  await functionClient().send(
    new DeleteFunctionCommand({ functionName: "edi-outbound" })
  );

  console.log("Done");
})();

async function emptyAndDeleteBucket(bucketName: string) {
  const client = await bucketClient();
  await emptyBucket(bucketName);
  await client.send(new DeleteBucketCommand({ bucketName }));
}
