import * as x12 from "@stedi/x12-tools/node.js";

import { EDIMetadata } from "./prepareMetadata.js";
import { generateControlNumber } from "./generateControlNumber.js";
import { deliverToDestination } from "./deliverToDestination.js";
import { EnabledAck } from "./types/PartnerRouting.js";
import { trackProgress } from "./progressTracking";

export const deliverAck = async (
  ack: EnabledAck,
  metadata: EDIMetadata,
  sendingPartnerId: string,
  receivingPartnerId: string
): Promise<void> => {
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

  ack.destination.path = `${ack.destination.path}/${isaControlNumber}-997.edi`;
  await trackProgress("delivering 997 ack to destination", {
    interchange: metadata.interchange,
    ackControlNumbers: {
      isaControlNumber,
      gsControlNumber
    },
    destination: ack.destination,
  });

  await deliverToDestination(ack.destination, ackEdi);
};