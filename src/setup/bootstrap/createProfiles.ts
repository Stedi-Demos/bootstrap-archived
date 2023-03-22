import { PartnerProfileSchema } from "../../lib/types/PartnerRouting.js";
import { SetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../lib/constants.js";
import { stashClient } from "../../lib/clients/stash.js";

export const createProfiles = async () => {
  const profiles = [
    {
      id: "this-is-me",
      partnerName: "Me, Myself and I",
      partnerInterchangeQualifier: "ZZ",
      partnerInterchangeId: "THISISME",
      acknowledgmentRequestedCode: "0",
      partnerApplicationId: "MYAPPID",
    },
    {
      id: "another-merchant",
      partnerName: "A.N. & Other Merchants",
      partnerInterchangeQualifier: "14",
      partnerInterchangeId: "ANOTHERMERCH",
      acknowledgmentRequestedCode: "0",
      partnerApplicationId: "ANOTAPPID",
    },
  ];

  console.log("Creating X12 Trading Partner Profile in Stash");
  const stash = stashClient();

  for (const profile of profiles) {
    const parseResult = PartnerProfileSchema.safeParse(profile);

    if (!parseResult.success) throw new Error(parseResult.error.message);
    // throw new Error(`Invalid profile for ${profile.id}`);

    await stash.send(
      new SetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `profile|${profile.id}`,
        value: parseResult.data,
      })
    );
  }
};
