import { GetProfileCommand, X12Profile } from "@stedi/sdk-client-partners";
import { partnersClient as buildPartnersClient } from "./partners.js";

const partnersClient = buildPartnersClient();

export const loadX12PartnerProfile = async (
  partnerId: string
): Promise<X12Profile> => {
  // load x12 Trading Partner profile
  const { x12: X12Profile } = await partnersClient.send(
    new GetProfileCommand({
      id: partnerId,
    })
  );

  if (X12Profile === undefined)
    throw new Error(`No X12 profile found for '${partnerId}'`);

  return X12Profile;
};
