import * as x12 from "@stedi/x12-tools/node.js";

import { EDIMetadata } from "./prepareMetadata.js";
import { generateControlNumber } from "./generateControlNumber.js";
import {
  DeliverToDestinationListInput,
  deliverToDestinations,
  DeliveryResult,
  generateDestinationFilename
} from "./destinations.js";
import { AckTransactionSet } from "./types/PartnerRouting.js";

export type AckDeliveryInput = {
  ackTransactionSet: AckTransactionSet;
  metadata: EDIMetadata;
  sendingPartnerId: string;
  receivingPartnerId: string;
};

export const deliverAck = async (input: AckDeliveryInput): Promise<DeliveryResult[]> => {
  const { ackTransactionSet, metadata, sendingPartnerId, receivingPartnerId } = input;

  // Generate control numbers for outbound 997
  const isaControlNumber = await generateControlNumber({
    segment: "ISA",
    usageIndicatorCode: metadata.interchange.usageIndicatorCode,
    sendingPartnerId,
    receivingPartnerId,
  });
  const gsControlNumber = await generateControlNumber({
    segment: "GS",
    usageIndicatorCode: metadata.interchange.usageIndicatorCode,
    sendingPartnerId,
    receivingPartnerId,
  });

  const ackEdi = x12.ack(metadata.edi, isaControlNumber, gsControlNumber);
  if (!ackEdi) {
    throw new Error(`failed to generate 997 for interchange: ${metadata.interchange.controlNumber}`);
  }

  const destinationFilename = generateDestinationFilename(isaControlNumber, "997", "edi");
  const deliverToDestinationsInput: DeliverToDestinationListInput = {
    destinations: ackTransactionSet.destinations,
    payload: ackEdi,
    destinationFilename,
  };
  return await deliverToDestinations(deliverToDestinationsInput);
};