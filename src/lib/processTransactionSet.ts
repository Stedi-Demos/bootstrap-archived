import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking.js";
import { invokeMapping } from "./mappings.js";

export const processTransactionSet = async (
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

  return mappingId !== undefined
    ? await invokeMapping(mappingId, { transactionSets: translation.transactionSets })
    : translation;
};
