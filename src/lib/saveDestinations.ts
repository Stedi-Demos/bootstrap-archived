import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import {
  TransactionSetDestinations,
  TransactionSetDestinationsSchema,
} from "./types/Destination.js";

const stash = stashClient();

export const saveTransactionSetDestinations = async (
  id: string,
  partnership: object
): Promise<TransactionSetDestinations> => {
  const parseResult = TransactionSetDestinationsSchema.safeParse(partnership);

  if (!parseResult.success) {
    console.dir(partnership, { depth: null });
    throw Error("Partnership does not match allowed schema");
  }

  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: id,
      value: parseResult.data,
    })
  );

  return parseResult.data;
};
