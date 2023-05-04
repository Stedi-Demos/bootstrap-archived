import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { DocumentType } from "@aws-sdk/types";
import { TransactionSetDestinations } from "./types/Destination.js";

const stash = stashClient();

export const saveTransactionSetDestinations = async (
  id: string,
  destinations: TransactionSetDestinations
): Promise<void> => {
  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: id,
      value: destinations as DocumentType,
    })
  );
};
