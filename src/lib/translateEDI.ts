import {
  Parsed,
  TranslateJsonToX12Command,
  TranslateX12ToJsonCommand,
} from "@stedi/sdk-client-edi-translate";
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

export const translateEdiToJson = async (
  input: string,
  guideId: string
): Promise<Parsed> => {
  const translateResult = await translateClient().send(
    new TranslateX12ToJsonCommand({
      input,
      guideId,
    })
  );

  if (!translateResult.output) {
    throw new Error("translation did not return any output");
  }

  return translateResult.output;
};
