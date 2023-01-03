import { GetValueCommand } from "@stedi/sdk-client-stash";
import { ROUTING_KEYSPACE_NAME } from "./constants.js";
import { stashClient as buildStashClient } from "./stash.js";
import { RoutingConfig } from "./types/RoutingConfig.js";

const stashClient = buildStashClient();

export const loadRouting = async (
  direction: "inbound" | "outbound",
  format: "X12",
  release: string,
  transactionSet: string
): Promise<RoutingConfig[]> => {
  const key = `${direction}/${format}/${release}/${transactionSet}`;
  const { value } = await stashClient.send(
    new GetValueCommand({
      keyspaceName: ROUTING_KEYSPACE_NAME,
      key,
    })
  );

  if (value === undefined)
    throw new Error(
      `No routing configuration found for '${key}' in '${ROUTING_KEYSPACE_NAME}' keyspace`
    );

  return value as RoutingConfig[];
};
