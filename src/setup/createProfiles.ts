import dotenv from "dotenv";
dotenv.config({ override: true });
import { CreateProfileCommand } from "@stedi/sdk-client-partners";
import { partnersClient as buildPartnersClient } from "../lib/partners.js";
import { stashClient as buildStashClient } from "../lib/stash.js";
import { PartnerProfleSchema } from "../lib/types/PartnerRouting.js";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";

(async () => {
  const profiles = [
    {
      id: "THISISME",
      partnerName: "Me, Myself and I",
      x12: {
        partnerInterchangeQualifier: "ZZ",
        partnerInterchangeId: "THISISME",
        acknowledgementRequestedCode: "0",
        partnerApplicationId: "MYAPPID",
      },
    },
    {
      id: "ANOTHERMERCH",
      partnerName: "A.N. & Other Merchants",
      x12: {
        partnerInterchangeQualifier: "ZZ",
        partnerInterchangeId: "ANOTHERMERCH",
        acknowledgementRequestedCode: "0",
        partnerApplicationId: "ANOTAPPID",
      },
    },
  ];

  if (process.env["USE_BETA"] === "true") {
    const partnersClient = buildPartnersClient();
    console.log("[BETA] Creating X12 Trading Partner Profile in Partners API");

    for (const profile of profiles) {
      try {
        await partnersClient.send(new CreateProfileCommand(profile));
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
    console.log("[BETA] Creating X12 Trading Partner Profile in Stash");
    const stashClient = buildStashClient();

    for (const profile of profiles) {
      const parseResult = PartnerProfleSchema.safeParse(profile);

      if (!parseResult.success) throw new Error(parseResult.error.message);
      // throw new Error(`Invalid profile for ${profile.id}`);

      await stashClient.send(
        new SetValueCommand({
          keyspaceName: PARTNERS_KEYSPACE_NAME,
          key: `profile|${profile.id}`,
          value: parseResult.data,
        })
      );
    }
  }
})();
