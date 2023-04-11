import { getRequiredValue } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { ErrorFromStashConfiguration } from "./errorFromStashConfiguration.js";
import { ErrorWithContext } from "./errorWithContext.js";
import {
  TransactionSetDestinations,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

export const loadTransactionDestinations = async ({
  partnershipId,
  transactionSetIdentifier,
}: {
  partnershipId: string;
  transactionSetIdentifier: string;
}): Promise<TransactionSetDestinations> => {
  try {
    const key = `destinations|${partnershipId}|${transactionSetIdentifier}`;
    const stashValue = await getRequiredValue(PARTNERS_KEYSPACE_NAME, key);

    const parsedValue = TransactionSetDestinationsSchema.safeParse(stashValue);

    if (!parsedValue.success) {
      throw new ErrorFromStashConfiguration(key, parsedValue);
    }
    return parsedValue.data;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      throw new ErrorWithContext("no transaction set configured", {
        transactionSetIdentifier,
        partnershipId,
      });

    throw error;
  }
};
