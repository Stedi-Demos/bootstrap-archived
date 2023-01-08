import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { stashClient as buildStashClient } from "./stash.js";
import { ISAPartnerIdLookupSchema } from "./types/PartnerRouting.js";

const stashClient = buildStashClient();

export const resolvePartnerIdFromISAId = async (
  isaId: string
): Promise<string> => {
  const key = `lookup|ISA|${isaId}`;
  const { value } = await stashClient.send(
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
