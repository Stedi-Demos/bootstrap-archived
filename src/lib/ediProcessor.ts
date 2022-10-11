import { DocumentType } from "@aws-sdk/types";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking";

const mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);

// TODO: remove
const debug = (message: string, context: any) => {
  const payloadString = `${message}: ${JSON.stringify(context)}`;
  console.log(payloadString);
};

export const detectTransactionSet = (ediDocument: string): string => {
  // The ISA segment should be 106 characters, so the entire document should be bigger than that
  if (ediDocument.length < 106 || !ediDocument.startsWith("ISA")) {
    throw new Error("invalid ISA segment");
  }

  const elementDelimiter = ediDocument.charAt(3);
  debug("element delimiter", elementDelimiter);

  const ediElements = ediDocument.split(elementDelimiter);
  debug("edi elements", ediElements);

  if (ediElements.length < 17) {
    throw new Error("too few elements detected in document");
  }

  const delimitersElement = ediElements[16];
  debug("delimiters element", delimitersElement);

  if (delimitersElement.length < 2) {
    throw new Error("invalid ISA segment");
  }

  const segmentDelimiter = delimitersElement[1];
  debug("segment delimiter", segmentDelimiter);

  if (!segmentDelimiter.match(/\r?\n|\r/g)) {
    ediDocument =ediDocument.replace(/\r?\n|\r/g, "");
  }

  const segments = ediDocument.split(segmentDelimiter);
  const stSegment = segments.find((segment) => segment.trim().startsWith("ST"));

  debug("split segments", segments);

  if (!stSegment) {
    throw new Error("no ST segment was found");
  }

  const stElements = stSegment.split(elementDelimiter);
  if (stElements.length !== 3) {
    throw new Error("invalid ST segment");
  }

  return stElements[1];
};

export const processEdiDocument = async (guideId: string, mappingId: string, ediDocument: string): Promise<DocumentType> => {
  const translation = await translateEdiToJson(ediDocument, guideId);
  await trackProgress("translated edi document", translation);

  if (!translation.envelope) {
    throw new Error(`no envelope found in input`);
  }

  if (!translation.transactionSets || translation.transactionSets.length === 0) {
    throw new Error(`no transaction sets found in input`);
  }

  // parse out only the desired content from the interchange/group headers to include in mapping input alongside guide-based JSON
  const { interchangeHeader, groupHeader } = translation.envelope as any;
  const { receiverId, senderId, controlNumber: interchangeControlNumber } = interchangeHeader;
  const { applicationSenderCode, applicationReceiverCode, controlNumber: groupControlNumber } = groupHeader;

  const mappingContent = {
    envelopeData: {
      interchangeHeader: {
        senderId,
        receiverId,
        interchangeControlNumber,
      },
      groupHeader: {
        applicationSenderCode,
        applicationReceiverCode,
        groupControlNumber,
      }
    },
    transactionSets: translation.transactionSets,
  }

  const mapResult = await mappingsClient.send(
    new MapDocumentCommand({
      id: mappingId,
      content: mappingContent,
    })
  );

  if (!mapResult.content) {
    const transactionSetControlNumbers = { interchangeControlNumber, groupControlNumber };
    throw new Error(`Failed to map transaction set. No content returned: ${JSON.stringify(transactionSetControlNumbers)}`);
  }

  return mapResult.content;
};
