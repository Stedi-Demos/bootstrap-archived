import {
  CreateX12PartnershipCommand,
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../../lib/clients/partners.js";

export const createProfiles = async () => {
  const localProfile: CreateX12ProfileCommandInput = {
    profileId: "This-Is-Me-Inc",
    profileType: "local",
    interchangeQualifier: "ZZ",
    interchangeId: "THISISME       ",
  };
  const remoteProfile: CreateX12ProfileCommandInput = {
    profileId: "Another-Merchant",
    profileType: "partner",
    interchangeQualifier: "14",
    interchangeId: "ANOTHERMERCH   ",
  };

  const partners = partnersClient();
  console.log("Creating X12 Trading Partner Profile in Partners API");

  for (const profile of [localProfile, remoteProfile]) {
    try {
      await partners.send(new CreateX12ProfileCommand(profile));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ResourceConflictException"
      )
        console.log("Partner profile already exists");
      else throw error;
    }
  }

  try {
    await partners.send(
      new CreateX12PartnershipCommand({
        partnershipId: `${localProfile.profileId}_${remoteProfile.profileId}`,
        localProfileId: localProfile.profileId,
        partnerProfileId: remoteProfile.profileId,
        functionalAcknowledgmentConfig: {
          acknowledgmentType: "997",
          generate: "ALWAYS",
          groupBy: "ONE_PER_INTERCHANGE",
        },
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceConflictException"
    )
      console.log("Partnership already exists");
    else throw error;
  }
};
