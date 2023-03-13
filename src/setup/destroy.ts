import { DeleteBucketCommand } from "@stedi/sdk-client-buckets";

import { DeleteGuideCommand } from "@stedi/sdk-client-guides";
import {
  PARTNERS_KEYSPACE_NAME,
  OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
  INBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
} from "../lib/constants.js";
import {
  DeleteKeyspaceCommand,
  GetValueCommand,
} from "@stedi/sdk-client-stash";
import { DeleteFunctionCommand } from "@stedi/sdk-client-functions";
import { BootstrapMetadataSchema } from "../lib/types/BootstrapMetadata.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";
import { stashClient } from "../lib/clients/stash.js";
import { bucketsClient } from "../lib/clients/buckets.js";
import { guidesClient } from "../lib/clients/guides.js";
import { functionsClient } from "../lib/clients/functions.js";
import { emptyBucket } from "../lib/buckets.js";

const stash = stashClient();
const buckets = bucketsClient();
const functions = functionsClient();
const guides = guidesClient();

(async () => {
  console.log("Deleting all resources provisioned by bootstrap");

  // get metadata from stash
  const bootstrapMetadata = await stash.send(
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
    await guides.send(new DeleteGuideCommand({ id: `LIVE_${guideId}` }));
    await guides.send(new DeleteGuideCommand({ id: `DRFT_${guideId}` }));
  }

  // Delete Stash keyspaces
  console.log("Deleting Stash Keyspaces");
  await stash.send(
    new DeleteKeyspaceCommand({ keyspaceName: PARTNERS_KEYSPACE_NAME })
  );
  await stash.send(
    new DeleteKeyspaceCommand({
      keyspaceName: OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    })
  );

  await stashClient().send(
    new DeleteKeyspaceCommand({
      keyspaceName: INBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    })
  );

  // Delete Functions
  console.log("Deleting Functions");
  const functionPaths = getFunctionPaths();
  for (const path of functionPaths) {
    const functionName = functionNameFromPath(path);
    await functions.send(new DeleteFunctionCommand({ functionName }));
  }

  console.log("Done");
})();

async function emptyAndDeleteBucket(bucketName: string) {
  await emptyBucket(bucketName);
  await buckets.send(new DeleteBucketCommand({ bucketName }));
}
