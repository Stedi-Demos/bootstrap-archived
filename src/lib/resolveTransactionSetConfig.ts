import { Partnership } from "./types/PartnerRouting";

type ResolveTransactionSetConfigInput = {
  partnership: Partnership;
  sendingPartnerId: string;
  receivingPartnerId: string;
};

export const resolveTransactionSetConfig = ({
  partnership,
  sendingPartnerId,
  receivingPartnerId,
}: ResolveTransactionSetConfigInput): Partnership["transactionSets"][0] => {
  const transactionSetConfig = partnership.transactionSets.find(
    (g) =>
      g.sendingPartnerId === sendingPartnerId &&
      g.receivingPartnerId === receivingPartnerId
  );

  if (transactionSetConfig === undefined)
    throw new Error(
      `No transaction set config configured for '${sendingPartnerId}' and '${receivingPartnerId}'`
    );

  return transactionSetConfig;
};
