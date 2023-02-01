import { translateEdiToJson } from "./translateV3.js";
import { trackProgress } from "./progressTracking.js";

export const processEdi = async (
  guideId: string,
  ediDocument: string,
): Promise<any> => {
  const translation = await translateEdiToJson(ediDocument, guideId);
  await trackProgress("translated edi document", translation);

  if (
    !translation.transactionSets ||
    translation.transactionSets.length === 0
  ) {
    throw new Error(`no transaction sets found in input`);
  }

  return translation;
};
