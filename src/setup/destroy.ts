import { DeleteBucketCommand } from "@stedi/sdk-client-buckets";
import { bucketClient, emptyBucket } from "../lib/clients/buckets.js";
import { stashClient } from "../lib/clients/stash.js";
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
import { functionClient } from "../lib/functions.js";
import { DeleteFunctionCommand } from "@stedi/sdk-client-functions";
import { BootstrapMetadataSchema } from "../lib/types/BootstrapMetadata.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";
import { partnersClient } from "../lib/clients/partners.js";
import {
  DeleteX12PartnershipCommand,
  DeleteX12ProfileCommand,
  ListX12PartnershipsCommand,
  ListX12ProfilesCommand,
} from "@stedi/sdk-client-partners";
import { guidesClient } from "../lib/clients/guides.js";

const guides = guidesClient();
const partners = partnersClient();

(async () => {
  console.log("Deleting all resources provisioned by bootstrap");

  // partnerships
  console.log("Deleting Partnerships");
  const { items: partnerships } = await partners.send(
    new ListX12PartnershipsCommand({})
  );

  if (partnerships !== undefined && partnerships.length > 0) {
    for (const partnership of partnerships) {
      await partners.send(
        new DeleteX12PartnershipCommand({
          partnershipId: partnership.partnershipId,
        })
      );
    }
  }

  // profiles
  console.log("Deleting Profiles");
  const { items: profiles } = await partners.send(
    new ListX12ProfilesCommand({})
  );

  if (profiles !== undefined && profiles.length > 0) {
    for (const profile of profiles) {
      await partners.send(
        new DeleteX12ProfileCommand({ profileId: profile.profileId })
      );
    }
  }

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
    await guides.send(new DeleteGuideCommand({ id: `LIVE_${guideId}` }));
    await guides.send(new DeleteGuideCommand({ id: `DRFT_${guideId}` }));
  }

  // Delete Stash keyspaces
  console.log("Deleting Stash Keyspaces");
  await stashClient().send(
    new DeleteKeyspaceCommand({ keyspaceName: PARTNERS_KEYSPACE_NAME })
  );
  await stashClient().send(
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
    await functionClient().send(new DeleteFunctionCommand({ functionName }));
  }

  console.log("Done");
})();

async function emptyAndDeleteBucket(bucketName: string) {
  const client = await bucketClient();
  await emptyBucket(bucketName);
  await client.send(new DeleteBucketCommand({ bucketName }));
}
