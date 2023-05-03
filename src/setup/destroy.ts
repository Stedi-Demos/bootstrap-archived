import { DeleteBucketCommand } from "@stedi/sdk-client-buckets";
import { DeleteGuideCommand } from "@stedi/sdk-client-guides";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
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
import { maxWaitTime } from "../support/contants.js";

const stash = stashClient();
const events = eventsClient();
const buckets = bucketsClient();
const functions = functionsClient();
const guides = guidesClient();
const partners = partnersClient();

// legacy keyspace names, no longer used
const OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME = "outbound-control-numbers";
const INBOUND_CONTROL_NUMBER_KEYSPACE_NAME = "inbound-control-numbers";

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
  // TODO: Cannot destroy sFTP and executions bucket as it's v1
  // await emptyAndDeleteBucket(resources.SFTP_BUCKET_NAME ?? "");
  // if (resources.EXECUTIONS_BUCKET_NAME !== undefined)
  //   await emptyAndDeleteBucket(resources.EXECUTIONS_BUCKET_NAME);

  // TODO: Cannot destroy core bucket without destroying core first,
  // core cannot be destroyed without emptying the core artifacts bucket,
  // which has a non-public name
  // if (resources.CORE_INGESTION_BUCKET_NAME !== undefined)
  //   await emptyAndDeleteBucket(resources.CORE_INGESTION_BUCKET_NAME);

  // Delete Guides
  console.log("Deleting Guides");
  for (const gId of resources.GUIDE_IDS ?? []) {
    const guideId = parseGuideId(gId);
    for (const id of [`LIVE_${guideId}`, `DRFT_${guideId}`]) {
      try {
        await guides.send(new DeleteGuideCommand({ id }));
      } catch (error) {}
    }
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
        console.log(`Keyspace: ${keyspaceName} already deleted`);
      else throw error;
    }
  }

  // Delete Event Bindings
  console.log("Deleting Event Bindings");
  const eventBindingPromises: unknown[] = [];
  for (const eventToFunctionBindingName of resources.EVENT_BINDING_NAMES ??
    []) {
    await events.send(
      new DeleteEventToFunctionBindingCommand({
        eventToFunctionBindingName,
      })
    );

    eventBindingPromises.push(
      waitUntilEventToFunctionBindingDeleteComplete(
        { client: events, maxWaitTime },
        { eventToFunctionBindingName }
      )
    );
  }

  await Promise.all(eventBindingPromises);

  // Delete Functions
  console.log("Deleting Functions");
  const functionPromises: unknown[] = [];
  for (const functionName of resources.FUNCTION_NAMES ?? []) {
    await functions.send(new DeleteFunctionCommand({ functionName }));
    functionPromises.push(
      waitUntilFunctionDeleteComplete(
        { client: functions, maxWaitTime },
        { functionName }
      ).catch((error) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          error.name === "ResourceNotFoundException"
        )
          console.log("Function already deleted");
        else throw error;
      })
    );
  }

  await Promise.all(functionPromises);

  console.log("Done");
})();

async function _emptyAndDeleteBucket(bucketName: string) {
  await emptyBucket(bucketName);
  await buckets.send(new DeleteBucketCommand({ bucketName }));
}
