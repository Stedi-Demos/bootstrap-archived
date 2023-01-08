import dotenv from "dotenv";
dotenv.config({ override: true });
import { CreateProfileCommand } from "@stedi/sdk-client-partners";
import { partnersClient as buildPartnersClient } from "../lib/partners.js";

(async () => {
  const partnersClient = buildPartnersClient();

  try {
    await partnersClient.send(
      new CreateProfileCommand({
        id: "THISISME",
        partnerName: "Me, Myself and I",
        x12: {
          partnerInterchangeQualifier: "ZZ",
          partnerInterchangeId: "THISISME",
          usageIndicatorCode: "T",
          acknowledgementRequestedCode: "0",
          agencyCode: "X",
          functionalGroups: [],
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
      console.log("Partner profile already exists");
    else throw error;
  }

  try {
    await partnersClient.send(
      new CreateProfileCommand({
        id: "ANOTHERMERCH",
        partnerName: "A.N. & Other Merchants",
        x12: {
          partnerInterchangeQualifier: "ZZ",
          partnerInterchangeId: "ANOTHERMERCH",
          usageIndicatorCode: "T",
          acknowledgementRequestedCode: "0",
          agencyCode: "X",
          functionalGroups: [],
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
      console.log("Partner profile already exists");
    else throw error;
  }
})();
