import dotenv from "dotenv";
dotenv.config({ override: true });
import { CreateX12ProfileCommand } from "@stedi/sdk-client-partners";
import { partnersClient as buildPartnersClient } from "../../lib/partners.js";
import { stashClient as buildStashClient } from "../../lib/stash.js";
import { PartnerProfileSchema } from "../../lib/types/PartnerRouting.js";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../lib/constants.js";

export const createProfiles = async () => {
  const profiles = [
    {
      profileId: "this-is-me",
      partnerName: "Me, Myself and I",
      partnerInterchangeQualifier: "ZZ",
      partnerInterchangeId: "THISISME",
      acknowledgmentRequestedCode: "0",
      partnerApplicationId: "MYAPPID",
    },
    {
      profileId: "another-merchant",
      partnerName: "A.N. & Other Merchants",
      partnerInterchangeQualifier: "14",
      partnerInterchangeId: "ANOTHERMERCH",
      acknowledgmentRequestedCode: "0",
      partnerApplicationId: "ANOTAPPID",
    },
  ];

  if (process.env["USE_BETA"] === "true") {
    const partnersClient = buildPartnersClient();
    console.log("[BETA] Creating X12 Trading Partner Profile in Partners API");

    for (const profile of profiles) {
      try {
        await partnersClient.send(new CreateX12ProfileCommand(profile));
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
  } else {
    console.log("Creating X12 Trading Partner Profile in Stash");
    const stashClient = buildStashClient();

    for (const profile of profiles) {
      const parseResult = PartnerProfileSchema.safeParse(profile);

      if (!parseResult.success) throw new Error(parseResult.error.message);
      // throw new Error(`Invalid profile for ${profile.id}`);

      await stashClient.send(
        new SetValueCommand({
          keyspaceName: PARTNERS_KEYSPACE_NAME,
          key: `profile|${profile.profileId}`,
          value: parseResult.data,
        })
      );
    }
  }
};
