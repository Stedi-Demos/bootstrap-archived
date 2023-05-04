import z from "zod";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { DocumentType } from "@aws-sdk/types";
import { DestinationErrorEventsSchema } from "./types/Destination.js";

const stash = stashClient();

export const saveErrorDestinations = async (
  id: string,
  destinations: z.input<typeof DestinationErrorEventsSchema>
): Promise<void> => {
  await stash.send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: id,
      value: destinations as DocumentType,
    })
  );
};
