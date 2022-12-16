import { DocumentType } from "@aws-sdk/types";
import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking.js";

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

  const mapResult = await mappingsClient.send(
    new MapDocumentCommand({
      id: mappingId,
      content: {
        envelope: translation.envelope,
        transactionSets: translation.transactionSets,
      }
    })
  );

  if (!mapResult.content) {
    throw new Error(`Failed to map transaction set. No content returned: ${JSON.stringify(translation.envelope)}`);
  }

  return mapResult.content;
};
