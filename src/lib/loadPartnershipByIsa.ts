import * as x12 from "@stedi/x12-tools";
import {
  GetX12PartnershipByInterchangesCommand,
  GetX12PartnershipByInterchangesCommandOutput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "./clients/partners.js";
import { InterchangePartnerDetail } from "./metadata.js";

const partners = partnersClient();

type LoadPartnershipParams = {
  sender: InterchangePartnerDetail;
  receiver: InterchangePartnerDetail;
  functionalGroupEnvelope: Omit<x12.FunctionalGroupEnvelope, "segments">;
};

export const loadPartnershipByISA = async ({
  sender,
  receiver,
}: LoadPartnershipParams): Promise<GetX12PartnershipByInterchangesCommandOutput> => {
  try {
    return await partners.send(
      new GetX12PartnershipByInterchangesCommand({
        localInterchangeIdentifier: sender,
        partnerInterchangeIdentifier: receiver,
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name !== "ResourceNotFoundException"
    )
      throw error;

    return await partners.send(
      new GetX12PartnershipByInterchangesCommand({
        localInterchangeIdentifier: receiver,
        partnerInterchangeIdentifier: sender,
      })
    );
  }
};
