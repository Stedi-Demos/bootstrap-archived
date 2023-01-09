import { ListValuesCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../lib/constants.js";
import { stashClient as buildStashClient } from "../../../lib/stash.js";
import { PartnershipSchema } from "../../../lib/types/PartnerRouting.js";

const stashClient = buildStashClient();

// This function can be called to validate configuration records in Stash
export const handler = async () => {
  const { items } = await stashClient.send(
    new ListValuesCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
    })
  );

  const partnerships = (items ?? []).filter((item) =>
    item.key?.toLowerCase().startsWith("partnership|")
  );

  for (const partnership of partnerships) {
    const result = PartnershipSchema.safeParse(partnership.value);

    if (!result.success) {
      return {
        error: `Partnership defined at '${partnership.key}' does not conform to the expected schema`,
        issue: result.error.errors,
      };
    }
  }

  const lookups = (items ?? []).filter((item) =>
    item.key?.toLowerCase().startsWith("lookup|")
  );

  return items;
};
