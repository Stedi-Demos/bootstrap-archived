import { Partnership } from "./types/PartnerRouting";

type ResolveTransactionSetConfigInput = {
  partnership: Partnership;
  sendingPartnerId: string;
  receivingPartnerId: string;
};

export const getTransactionSetConfigsForPartnership = ({
  partnership,
  sendingPartnerId,
  receivingPartnerId,
}: ResolveTransactionSetConfigInput): Partnership["transactionSets"] => {
  const transactionSetConfigs = partnership.transactionSets.filter(
    (config) =>
      config.sendingPartnerId === sendingPartnerId &&
      config.receivingPartnerId === receivingPartnerId
  );

  if (transactionSetConfigs.length === 0)
    throw new Error(
      `No transaction sets configured for '${sendingPartnerId}' and '${receivingPartnerId}'`
    );

  return transactionSetConfigs;
};

export const resolveTransactionSetConfig = (
  transactionSetConfigs: Partnership["transactionSets"],
  guideId: string
): Partnership["transactionSets"][0] => {
  const transactionSetConfig = transactionSetConfigs.find(
    (config) => config.guideId === guideId
  );

  if (transactionSetConfig === undefined) {
    throw new Error(
      `no matching transaction set config found for guide id: '${guideId}'`
    );
  }

  return transactionSetConfig;
};
