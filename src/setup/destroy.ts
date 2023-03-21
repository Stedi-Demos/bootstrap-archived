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
import {
  DeleteFunctionCommand,
  waitUntilFunctionDeleteComplete,
} from "@stedi/sdk-client-functions";
import {
  BootstrapMetadata,
  BootstrapMetadataSchema,
} from "../lib/types/BootstrapMetadata.js";
import { stashClient } from "../lib/clients/stash.js";
import { bucketsClient } from "../lib/clients/buckets.js";
import { guidesClient } from "../lib/clients/guides.js";
import { functionsClient } from "../lib/clients/functions.js";
import { emptyBucket } from "../lib/buckets.js";
import { partnersClient } from "../lib/clients/partners.js";
import {
  DeleteX12PartnershipCommand,
  DeleteX12ProfileCommand,
} from "@stedi/sdk-client-partners";
import { parseGuideId } from "../support/guide.js";
import { eventsClient } from "../lib/clients/events.js";
import {
  DeleteEventToFunctionBindingCommand,
  waitUntilEventToFunctionBindingDeleteComplete,
} from "@stedi/sdk-client-events";
import { maxWaitTime } from "./contants.js";

const stash = stashClient();
const events = eventsClient();
const buckets = bucketsClient();
const functions = functionsClient();
const guides = guidesClient();
const partners = partnersClient();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  console.log("Deleting all resources provisioned by bootstrap");

  // get metadata from stash
  let resources: BootstrapMetadata["resources"] = {};
  try {
    const bootstrapMetadata = await stash.send(
      new GetValueCommand({
        keyspaceName: "partners-configuration",
        key: "bootstrap|metadata",
      })
    );

    resources = BootstrapMetadataSchema.parse(
      bootstrapMetadata.value
    ).resources;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "KeyspaceNotFoundError"
    )
      console.log("Metadata not found, skipping deletion of resources");
    else throw error;
  }

  // partnerships
  console.log("Deleting Partnerships");
  for (const partnershipId of resources.PARTNERSHIP_IDS ?? []) {
    await partners.send(
      new DeleteX12PartnershipCommand({
        partnershipId,
      })
    );
  }

  // profiles
  console.log("Deleting Profiles");
  for (const profileId of resources.PROFILE_IDS ?? []) {
    await partners.send(new DeleteX12ProfileCommand({ profileId }));
  }

  // Delete Buckets
  console.log("Deleting Buckets");
  // TODO Cannot destroy sFTP bucket as it's v1
  // await emptyAndDeleteBucket(resources.SFTP_BUCKET_NAME ?? "");

  if (resources.EXECUTIONS_BUCKET_NAME !== undefined)
    await emptyAndDeleteBucket(resources.EXECUTIONS_BUCKET_NAME);

  // Delete Guides
  console.log("Deleting Guides");
  for (const gId of resources.GUIDE_IDS ?? []) {
    const guideId = parseGuideId(gId);
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

  // Delete Event Bindings
  console.log("Deleting Event Bindings");
  for (const eventToFunctionBindingName of resources.EVENT_BINDING_NAMES ??
    []) {
    await events.send(
      new DeleteEventToFunctionBindingCommand({
        eventToFunctionBindingName,
      })
    );

    await waitUntilEventToFunctionBindingDeleteComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName }
    );
  }

  // Delete Functions
  console.log("Deleting Functions");
  for (const functionName of resources.FUNCTION_NAMES ?? []) {
    try {
      await functions.send(new DeleteFunctionCommand({ functionName }));
      await waitUntilFunctionDeleteComplete(
        { client: functions, maxWaitTime },
        { functionName }
      );
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
