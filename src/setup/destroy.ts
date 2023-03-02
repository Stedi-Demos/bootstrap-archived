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
import { partnersClient } from "../lib/clients/partners.js";
import {
  DeleteX12PartnershipCommand,
  DeleteX12ProfileCommand,
  ListX12PartnershipsCommand,
  ListX12ProfilesCommand,
} from "@stedi/sdk-client-partners";

const stash = stashClient();
const buckets = bucketsClient();
const functions = functionsClient();
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
  const keyspaces = [
    PARTNERS_KEYSPACE_NAME,
    OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    INBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
  ];
  for (const keyspaceName of keyspaces) {
    try {
      await stashClient().send(
        new DeleteKeyspaceCommand({
          keyspaceName,
        })
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "KeyspaceNotFoundError"
      )
        console.log("Keyspace already deleted");
      else throw error;
    }
  }

  // Delete Functions
  console.log("Deleting Functions");
  const functionPaths = getFunctionPaths();
  for (const path of functionPaths) {
    const functionName = functionNameFromPath(path);
    try {
      await functions.send(new DeleteFunctionCommand({ functionName }));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ResourceNotFoundException"
      )
        console.log("Function already deleted");
      else throw error;
    }
  }

  console.log("Done");
})();

async function emptyAndDeleteBucket(bucketName: string) {
  await emptyBucket(bucketName);
  await buckets.send(new DeleteBucketCommand({ bucketName }));
}
