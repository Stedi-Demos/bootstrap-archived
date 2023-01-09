import {
  GetProfileCommand,
  GetProfileCommandOutput,
  X12Profile,
} from "@stedi/sdk-client-partners";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { partnersClient as buildPartnersClient } from "./partners.js";
import { stashClient as buildStashClient } from "./stash.js";
import { PartnerProfleSchema } from "./types/PartnerRouting.js";

const stashClient = buildStashClient();

const partnersClient = buildPartnersClient();

type Profile = Omit<
  GetProfileCommandOutput,
  "createdAt" | "updatedAt" | "$metadata"
> & {
  x12: X12Profile;
};

export const loadPartnerProfile = async (
  partnerId: string
): Promise<Profile> => {
  if (process.env["USE_BETA"] === "true") {
    // load x12 Trading Partner Profile (pre-GA)
    const profile = await partnersClient.send(
      new GetProfileCommand({
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

    const { value } = await stashClient.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `profile|${partnerId}`,
      })
    );

    if (value === undefined)
      throw new Error(
        `No X12 profile id at '${key}' in '${PARTNERS_KEYSPACE_NAME}'`
      );

    const parsedProfile = PartnerProfleSchema.safeParse(value);

    if (!parsedProfile.success)
      throw new Error(
        `X12 profile at'${key}' in '${PARTNERS_KEYSPACE_NAME}' does not match allowed schema`
      );

    return parsedProfile.data satisfies Profile;
  }
};
