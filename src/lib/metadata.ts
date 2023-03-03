import * as x12 from "@stedi/x12-tools";

export type InterchangePartnerDetail = {
  interchangeQualifier: string;
  interchangeId: string;
};

type InterchangeData = {
  sender: InterchangePartnerDetail;
  receiver: InterchangePartnerDetail;
  delimiters: x12.Delimiters;
  interchangeSegments: x12.InterchangeSegments;
};

export const extractInterchangeData = ({
  envelope,
  delimiters,
}: x12.Interchange): InterchangeData => {
  if (!envelope) {
    throw new Error("invalid interchange: unable to extract envelope");
  }

  if (
    !envelope?.senderId ||
    !envelope?.senderQualifier ||
    !envelope?.receiverId ||
    !envelope?.receiverQualifier
  ) {
    throw new Error("invalid interchange: unable to extract interchange ids");
  }

  if (!delimiters) {
    throw new Error("invalid interchange: unable to extract delimiters");
  }

  return {
    sender: {
      interchangeQualifier: envelope.senderQualifier,
      interchangeId: envelope.senderId,
    },
    receiver: {
      interchangeQualifier: envelope.receiverQualifier,
      interchangeId: envelope.receiverId,
    },
    delimiters,
    interchangeSegments: envelope.segments,
  };
};

export const extractFunctionalGroupData = (
  functionalGroup: x12.FunctionalGroup
): x12.FunctionalGroupEnvelope => {
  if (!functionalGroup.envelope?.segments) {
    throw new Error(
      "invalid functional group: unable to extract functional group segments"
    );
  }

  return functionalGroup.envelope;
};

export const extractTransactionSetData = (
  transactionSet: x12.TransactionSet
): { id: string } => {
  if (!transactionSet.id) {
    throw new Error("invalid transaction set: unable to extract identifier");
  }

  return { id: transactionSet.id };
};
