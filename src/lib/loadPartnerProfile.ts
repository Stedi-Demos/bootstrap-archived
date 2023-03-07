import {
  GetX12ProfileCommand,
  GetX12ProfileCommandOutput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "./clients/partners.js";

const partners = partnersClient();

export const loadProfile = async (
  profileId: string
): Promise<GetX12ProfileCommandOutput> => {
  const profile = await partners.send(
    new GetX12ProfileCommand({
      profileId,
    })
  );

  if (profile === undefined)
    throw new Error(`No X12 profile found for '${profileId}' in Partners API`);

  return profile;
};
