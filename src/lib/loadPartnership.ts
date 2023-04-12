import { GetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "./clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "./constants.js";
import { PartnershipSchema, Partnership } from "./types/PartnerRouting.js";
import { ErrorWithContext } from "./errorWithContext.js";

const stash = stashClient();

export const loadPartnership = async (
  sendingPartnerId: string,
  receivingPartnerId: string
): Promise<Partnership> => {
  let partnership: Partnership | undefined;

  const keysToCheck = [
    `partnership|${sendingPartnerId}|${receivingPartnerId}`,
    `partnership|${receivingPartnerId}|${sendingPartnerId}`,
  ];

  for (const key of keysToCheck) {
    const { value } = await stash.send(
      new GetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key,
      })
    );

    if (value !== null && typeof value === "object") {
      const parsedPartnership = PartnershipSchema.safeParse(value);
      if (!parsedPartnership.success) {
        throw new ErrorWithContext(
          "Invalid Partnership configuration",
          parsedPartnership.error.issues
        );
      }
      partnership = parsedPartnership.data;
      break;
    }
  }

  if (partnership === undefined)
    throw new Error(
      `No partnership found for '${sendingPartnerId}' and '${receivingPartnerId}' in '${PARTNERS_KEYSPACE_NAME}' keyspace`
    );

  return partnership;
};
