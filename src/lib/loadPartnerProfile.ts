import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";

import {
  PartnerProfile,
  PartnerProfileSchema,
} from "./types/PartnerRouting.js";

const stash = stashClient();

export const loadPartnerProfile = async (
  profileId: string
): Promise<PartnerProfile> => {
  // load replica of x12 Trading Partner Profile from Stash
  const key = `profile|${profileId}`;

  const { value } = await stash.send(
    new GetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `profile|${profileId}`,
    })
  );

  if (value === undefined)
    throw new Error(
      `profile '${key}' in '${PARTNERS_KEYSPACE_NAME}' does not exist`
    );

  const parsedProfile = PartnerProfileSchema.safeParse(value);

  if (!parsedProfile.success)
    throw new Error(
      `profile at'${key}' in '${PARTNERS_KEYSPACE_NAME}' does not match allowed schema`
    );

  return parsedProfile.data;
};
