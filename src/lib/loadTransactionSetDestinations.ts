import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import {
  TransactionSetDestinations,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

const stash = stashClient();

export const loadTransactionSetDestinations = async (
  transactionRuleId: string
): Promise<TransactionSetDestinations> => {
  const params = {
    keyspaceName: PARTNERS_KEYSPACE_NAME,
    key: `destinations|${transactionRuleId}`,
  };

  const { value } = await stash.send(new GetValueCommand(params));

  return TransactionSetDestinationsSchema.parse(value);
};
