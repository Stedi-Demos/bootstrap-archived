import { DocumentType } from "@aws-sdk/types";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking";

const mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);

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
