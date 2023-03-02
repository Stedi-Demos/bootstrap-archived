import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { ISAPartnerIdLookupSchema } from "./types/PartnerRouting.js";

const stash = stashClient();

export const resolvePartnerIdFromISAId = async (
  isaId: string
): Promise<string> => {
  const key = `lookup|ISA|${isaId}`;
  const { value } = await stash.send(
    new GetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key,
    })
  );

  if (value === undefined)
    throw new Error(`No partner profile id found for '${isaId}'`);

  const { partnerId } = ISAPartnerIdLookupSchema.parse(value);

  return partnerId;
};
