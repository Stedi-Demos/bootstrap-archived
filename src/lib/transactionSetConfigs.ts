import {
  AckTransactionSet,
  isAckTransactionSet,
  isNonAckTransactionSet,
  isTransactionSetWithGuideId,
  isTransactionSetWithoutGuideId,
  Partnership,
  TransactionSetWithGuideId,
  TransactionSetWithoutGuideId,
} from "./types/PartnerRouting.js";

interface ResolveTransactionSetConfigInput {
  partnership: Partnership;
  sendingPartnerId: string;
  receivingPartnerId: string;
}

interface GroupedTransactionSets {
  transactionSetConfigsWithoutGuideIds: TransactionSetWithoutGuideId[];
  transactionSetConfigsWithGuideIds: TransactionSetWithGuideId[];
}

export const getTransactionSetConfigsForPartnership = ({
  partnership,
  sendingPartnerId,
  receivingPartnerId,
}: ResolveTransactionSetConfigInput): Partnership["transactionSets"] => {
  const transactionSetConfigs = partnership.transactionSets.filter((config) => {
    // ack transaction set does not include partner ids (they are inferred from interchange being acknowledged)
    return (
      isAckTransactionSet(config) ||
      (isNonAckTransactionSet(config) &&
        config.sendingPartnerId === sendingPartnerId &&
        config.receivingPartnerId === receivingPartnerId)
    );
  });

  if (transactionSetConfigs.length === 0)
    throw new Error(
      `No transaction sets configured for '${sendingPartnerId}' and '${receivingPartnerId}'`
    );

  return transactionSetConfigs;
};

export const resolveTransactionSetConfig = (
  transactionSetConfigs: TransactionSetWithGuideId[],
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

export const groupTransactionSetConfigsByType = (
  transactionSetConfigs: Partnership["transactionSets"]
): GroupedTransactionSets => {
  return transactionSetConfigs.reduce(
    (groupedConfigs: GroupedTransactionSets, currentConfig) => {
      if (isTransactionSetWithGuideId(currentConfig)) {
        groupedConfigs.transactionSetConfigsWithGuideIds.push(currentConfig);
      } else if (isTransactionSetWithoutGuideId(currentConfig)) {
        groupedConfigs.transactionSetConfigsWithoutGuideIds.push(currentConfig);
      } else {
        throw new Error("invalid transaction set configuration encountered");
      }

      return groupedConfigs;
    },
    {
      transactionSetConfigsWithoutGuideIds: [],
      transactionSetConfigsWithGuideIds: [],
    }
  );
};

export const getAckTransactionConfig = (
  transactionSetConfigs: TransactionSetWithoutGuideId[]
): AckTransactionSet => {
  const ackTransactionSetList =
    transactionSetConfigs.filter(isAckTransactionSet);
  const ackTransactionSetCount = ackTransactionSetList.length;
  if (ackTransactionSetCount !== 1) {
    throw new Error(
      `expected exactly 1 acknowledgment transaction set configuration, found: ${ackTransactionSetCount}`
    );
  }

  return ackTransactionSetList[0];
};
