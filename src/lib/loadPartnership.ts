import * as x12 from "@stedi/x12-tools";
import {
  GetX12PartnershipByX12IdentifiersCommand,
  GetX12PartnershipByX12IdentifiersCommandOutput,
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
  functionalGroupEnvelope,
}: LoadPartnershipParams): Promise<GetX12PartnershipByX12IdentifiersCommandOutput> => {
  try {
    return await partners.send(
      new GetX12PartnershipByX12IdentifiersCommand({
        localInterchangeIdentifier: {
          ...sender,
          applicationId: functionalGroupEnvelope.applicationSenderCode,
        },
        partnerInterchangeIdentifier: {
          ...receiver,
          applicationId: functionalGroupEnvelope.applicationReceiverCode,
        },
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
      new GetX12PartnershipByX12IdentifiersCommand({
        localInterchangeIdentifier: {
          ...receiver,
          applicationId: functionalGroupEnvelope.applicationReceiverCode,
        },
        partnerInterchangeIdentifier: {
          ...sender,
          applicationId: functionalGroupEnvelope.applicationSenderCode,
        },
      })
    );
  }
};
