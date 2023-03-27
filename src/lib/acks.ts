import * as x12 from "@stedi/x12-tools";

import { generateControlNumber } from "./generateControlNumber.js";
import {
  ProcessDeliveriesInput,
  processDeliveries,
  DeliveryResult,
  generateDestinationFilename,
} from "./deliveryManager.js";
import {
  AckTransactionSet,
  UsageIndicatorCodeSchema,
} from "./types/PartnerRouting.js";
import { format } from "date-fns";
import { ErrorWithContext } from "./errorWithContext.js";

export interface AckDeliveryInput {
  ackTransactionSet: AckTransactionSet;
  interchange: x12.Interchange;
  functionalGroup: x12.FunctionalGroup;
  sendingPartnerId: string;
  receivingPartnerId: string;
}

export const deliverAck = async (
  input: AckDeliveryInput
): Promise<DeliveryResult[]> => {
  const { ackTransactionSet, interchange, functionalGroup } = input;
  const usageIndicatorCode = UsageIndicatorCodeSchema.parse(
    interchange.envelope?.usageIndicatorCode
  );

  if (!interchange.envelope || !functionalGroup.envelope) {
    return [];
  }

  // Generate control numbers for outbound 997
  const isaControlNumber = await generateControlNumber({
    segment: "ISA",
    usageIndicatorCode,
    sendingPartnerId: input.receivingPartnerId,
    receivingPartnerId: input.sendingPartnerId,
  });
  const gsControlNumber = await generateControlNumber({
    segment: "GS",
    usageIndicatorCode,
    sendingPartnerId: input.receivingPartnerId,
    receivingPartnerId: input.sendingPartnerId,
  });

  try {
    const ackEdi = x12.generate997(
      json997Accepted(
        functionalGroup.envelope.controlNumber!,
        functionalGroup.envelope.functionalIdentifierCode!,
        functionalGroup.transactionSets.length
      ),
      {
        interchangeHeader: {
          senderQualifier: interchange.envelope.receiverQualifier!,
          senderId: interchange.envelope.receiverId!,
          receiverQualifier: interchange.envelope.senderQualifier!,
          receiverId: interchange.envelope.senderId!,
          date: format(new Date(), "yyyy-MM-dd"),
          time: format(new Date(), "HH:mm"),
          controlNumber: isaControlNumber,
          controlVersionNumber: interchange.envelope.versionNumberCode!,
          usageIndicatorCode: interchange.envelope.usageIndicatorCode!,
        },
        groupHeader: {
          functionalIdentifierCode: "FA",
          applicationSenderCode:
            functionalGroup.envelope.applicationReceiverCode!,
          applicationReceiverCode:
            functionalGroup.envelope.applicationSenderCode!,
          date: format(new Date(), "yyyy-MM-dd"),
          time: format(new Date(), "HH:mm:ss"),
          controlNumber: gsControlNumber,
          release: functionalGroup.envelope.release!,
        },
      }
    );
    const destinationFilename = generateDestinationFilename(
      isaControlNumber,
      "997",
      "edi"
    );
    const processDeliveriesInput: ProcessDeliveriesInput = {
      destinations: ackTransactionSet.destinations,
      payload: ackEdi,
      destinationFilename,
    };
    return await processDeliveries(processDeliveriesInput);
  } catch (e) {
    throw new ErrorWithContext("failed to generate 997", { error: e, input });
  }
};

const json997Accepted = (
  gsControlNumber: number,
  functionalGroupId: string,
  numberOfTransactionSets: number
) => {
  return {
    heading: {
      transaction_set_header_ST: {
        transaction_set_identifier_code_01: "997",
        transaction_set_control_number_02: 1,
      },
      functional_group_response_header_AK1: {
        functional_identifier_code_01: functionalGroupId,
        group_control_number_02: gsControlNumber,
      },
      functional_group_response_trailer_AK9: {
        functional_group_acknowledge_code_01: "A",
        number_of_transaction_sets_included_02: numberOfTransactionSets,
        number_of_received_transaction_sets_03: numberOfTransactionSets,
        number_of_accepted_transaction_sets_04: numberOfTransactionSets,
      },
    },
  };
};
