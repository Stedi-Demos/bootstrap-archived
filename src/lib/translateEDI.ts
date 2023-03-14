import { TranslateJsonToX12Command } from "@stedi/sdk-client-edi-translate";
import { translateClient } from "./clients/translate.js";

const translate = translateClient();

export const translateJsonToEdi = async (
  input: any,
  guideId: string | undefined,
  envelope: any
): Promise<string> => {
  console.log({ guideId });
  if (guideId === undefined)
    throw Error(
      "Transaction Configuration must have a guide assigned for writing EDI"
    );

  const translateResult = await translate.send(
    new TranslateJsonToX12Command({
      guideId,
      input,
      envelope,
    })
  );

  if (!translateResult.output) {
    throw new Error("translation did not return any output");
  }

  return translateResult.output;
};
