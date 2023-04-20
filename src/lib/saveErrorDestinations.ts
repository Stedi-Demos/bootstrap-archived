import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { DocumentType } from "@aws-sdk/types";
import {
  ErrorDestinations,
  ErrorDestinationsSchema,
} from "./types/ErrorDestinations.js";

const stash = stashClient();

export const saveErrorDestinations = async (
  id: string,
  destinations: object
): Promise<ErrorDestinations> => {
  const parseResult = ErrorDestinationsSchema.safeParse(destinations);

  if (!parseResult.success) {
    console.dir(destinations, { depth: null });
    console.dir(parseResult.error, { depth: null });
    throw Error(
      "Error destinations configuration does not match allowed schema"
    );
  }

  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: id,
      value: parseResult.data as DocumentType,
    })
  );

  return parseResult.data;
};
