import {
  GetX12ProfileCommand,
  GetX12ProfileCommandOutput,
} from "@stedi/sdk-client-partners";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { partnersClient } from "./clients/partners.js";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";

import { PartnerProfileSchema } from "./types/PartnerRouting.js";

const stash = stashClient();
const partners = partnersClient();

type Profile = Omit<
  GetX12ProfileCommandOutput,
  "createdAt" | "updatedAt" | "$metadata"
>;

export const loadPartnerProfile = async (
  partnerId: string
): Promise<Profile> => {
  if (process.env["USE_BETA"] === "true") {
    // load x12 Trading Partner Profile (pre-GA)
    const profile = await partners.send(
      new GetX12ProfileCommand({
        id: partnerId,
      })
    );

    if (profile === undefined)
      throw new Error(
        `No partner profile found for '${partnerId}' in Partners API`
      );

    return profile as Profile;
  } else {
    // load replica of x12 Trading Partner Profile from Stash
    const key = `profile|${partnerId}`;

    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `profile|${partnerId}`,
      })
    );

    if (value === undefined)
      throw new Error(
        `No X12 profile id at '${key}' in '${PARTNERS_KEYSPACE_NAME}'`
      );

    const parsedProfile = PartnerProfileSchema.safeParse(value);

    if (!parsedProfile.success)
      throw new Error(
        `X12 profile at'${key}' in '${PARTNERS_KEYSPACE_NAME}' does not match allowed schema`
      );

    return parsedProfile.data satisfies Profile;
  }
};
