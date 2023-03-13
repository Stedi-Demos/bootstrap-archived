import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import {
  Destination,
  DestinationSchema,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

const stash = stashClient();

export const loadDestinations = async (
  transactionRuleId: string
): Promise<Destination[]> => {
  try {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `destinations|${transactionRuleId}`,
      })
    );

    return TransactionSetDestinationsSchema.parse(value).destinations;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      return [];
    else throw error;
  }
};
