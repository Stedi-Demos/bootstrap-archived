import { ListValuesCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
import { savePartnership } from "../lib/savePartnership.js";

const stash = stashClient();

export const up = async () => {
  const partnerships = await loadPartnerships();

  for (const partnership of partnerships) {
    if ("transactionSets" in partnership === false) {
      console.dir(partnership, { depth: null });
      throw new Error("Partnership is missing required key 'transactionSets'");
    }

    const partnerIds = new Set<string>();

    partnership.transactionSets = partnership.transactionSets.map(
      (txnSet: any) => {
        if ("guideIds" in txnSet === false || !Array.isArray(txnSet.guideIds)) {
          console.dir(txnSet, { depth: null });
          throw new Error(
            "Transaction Set key 'guideIds', is either missing or not an array"
          );
        }

        partnerIds.add(txnSet.sendingPartnerId);
        partnerIds.add(txnSet.receivingPartnerId);

        const guideId = txnSet.guideIds[0];
        delete txnSet.guideIds;
        txnSet.guideId = guideId;
        return txnSet;
      }
    );

    if (partnerIds.size !== 2) {
      console.dir(partnership, { depth: null });
      throw new Error("Partnership has more than two unique partner IDs");
    }

    const id = partnership.id;
    delete partnership.id;

    await savePartnership(id, partnership);
  }
};

const loadPartnerships = async (): Promise<any[]> => {
  const { items } = await stash.send(
    new ListValuesCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
    })
  );

  return (items ?? [])
    .filter((item) => item.key?.toLowerCase().startsWith("partnership|"))
    .map((item) => ({ id: item.key, ...(item.value as object) }));
};
