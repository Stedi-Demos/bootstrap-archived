import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import {
  TransactionSetDestinations,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

const stash = stashClient();

export const loadTransactionDestinations = async ({
  partnershipId,
  transactionSetIdentifier,
}: {
  partnershipId: string;
  transactionSetIdentifier: string;
}): Promise<TransactionSetDestinations> => {
  try {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `destinations|${partnershipId}|${transactionSetIdentifier}`,
      })
    );

    return TransactionSetDestinationsSchema.parse(value);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      return { destinations: [] };

    throw error;
  }
};
