import {
  GetX12PartnershipCommand,
  GetX12PartnershipCommandOutput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "./clients/partners.js";

const partners = partnersClient();

export const loadPartnershipById = async ({
  partnershipId,
}: {
  partnershipId: string;
}): Promise<GetX12PartnershipCommandOutput> => {
  console.log({ partnershipId });
  return await partners.send(new GetX12PartnershipCommand({ partnershipId }));
};
