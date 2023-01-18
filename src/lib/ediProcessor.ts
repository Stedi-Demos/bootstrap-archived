import { MapDocumentCommand, MappingsClient } from "@stedi/sdk-client-mappings";
import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking.js";

const mappingsClient = new MappingsClient(DEFAULT_SDK_CLIENT_PROPS);

export const processEdiDocument = async (
  guideId: string,
  ediDocument: string,
  mappingId?: string
): Promise<any> => {
  const translation = await translateEdiToJson(ediDocument, guideId);
  await trackProgress("translated edi document", translation);

  if (
    !translation.transactionSets ||
    translation.transactionSets.length === 0
  ) {
    throw new Error(`no transaction sets found in input`);
  }

  if (mappingId !== undefined) {
    const mapResult = await mappingsClient.send(
      new MapDocumentCommand({
        id: mappingId,
        content: {
          transactionSets: translation.transactionSets,
        },
      })
    );

    if (!mapResult.content) {
      throw new Error(
        `Failed to map transaction set. No content returned: ${JSON.stringify(
          translation.envelope
        )}`
      );
    }

    return mapResult.content;
  }

  return translation;
};
