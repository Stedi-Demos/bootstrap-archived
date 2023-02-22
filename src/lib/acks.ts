import * as x12 from "@stedi/x12-tools";

import { generateControlNumber } from "./generateControlNumber.js";
import {
  ProcessDeliveriesInput,
  processDeliveries,
  DeliveryResult,
  generateDestinationFilename
} from "./deliveryManager.js";
import { AckTransactionSet, UsageIndicatorCodeSchema } from "./types/PartnerRouting.js";

export type AckDeliveryInput = {
  ackTransactionSet: AckTransactionSet;
  interchange: x12.Interchange;
  edi: string;
  sendingPartnerId: string;
  receivingPartnerId: string;
};

export const deliverAck = async (input: AckDeliveryInput): Promise<DeliveryResult[]> => {
  const { ackTransactionSet, interchange, edi, sendingPartnerId, receivingPartnerId } = input;
  const usageIndicatorCode = UsageIndicatorCodeSchema.parse(interchange.envelope?.usageIndicatorCode);

  // Generate control numbers for outbound 997
  const isaControlNumber = await generateControlNumber({
    segment: "ISA",
    usageIndicatorCode,
    sendingPartnerId,
    receivingPartnerId,
  });
  const gsControlNumber = await generateControlNumber({
    segment: "GS",
    usageIndicatorCode,
    sendingPartnerId,
    receivingPartnerId,
  });

  const ackEdi = x12.ack(edi, isaControlNumber, gsControlNumber);
  if (!ackEdi) {
    const interchangeIdentifier = interchange.envelope?.controlNumber || "<MISSING_CONTROL_NUMBER>";
    throw new Error(`failed to generate 997 for interchange: ${interchangeIdentifier}`);
  }

  const destinationFilename = generateDestinationFilename(isaControlNumber, "997", "edi");
  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations: ackTransactionSet.destinations,
    payload: ackEdi,
    destinationFilename,
  };
  return await processDeliveries(processDeliveriesInput);
};