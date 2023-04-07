import { GetValueCommand } from "@stedi/sdk-client-stash";

import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { Destination } from "./types/Destination.js";
import { ReplicationConfigSchema } from "./types/ReplicationConfig.js";
import { stashClient } from "./clients/stash.js";
import {
  DeliveryResult,
  processDeliveries,
  ProcessDeliveriesInput,
} from "./deliveryManager.js";

const keyspaceName = PARTNERS_KEYSPACE_NAME;
const replicationConfigStashKey = "bootstrap|replication-config";

export const processReplication = async ({
  currentKey,
  body,
}: {
  currentKey: string;
  body: string;
}): Promise<DeliveryResult[]> => {
  const replicationDestinations = await getReplicationDestinations();
  const replicationDeliveriesInput: ProcessDeliveriesInput = {
    destinations: replicationDestinations,
    payload: body,
    destinationFilename: getReplicationFilenameFromKey(currentKey),
  };

  return await processDeliveries(replicationDeliveriesInput);
};

const getReplicationDestinations = async (): Promise<Destination[]> => {
  const stashResponse = await stashClient().send(
    new GetValueCommand({
      keyspaceName,
      key: replicationConfigStashKey,
    })
  );

  return stashResponse.value
    ? ReplicationConfigSchema.parse(stashResponse.value).destinations
    : [];
};

const getReplicationFilenameFromKey = (currentKey: string): string =>
  currentKey.split("/").pop() ?? currentKey;
