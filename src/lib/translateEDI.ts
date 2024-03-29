import { DocumentType } from "@aws-sdk/types";
import {
  Parsed,
  TranslateJsonToX12Command,
  TranslateX12ToJsonCommand,
} from "@stedi/sdk-client-edi-translate";
import * as x12Tools from "@stedi/x12-tools";
import { translateClient } from "./clients/translate.js";
import { EdiTranslateWriteEnvelope } from "./types/EdiTranslateWriteEnvelope.js";

const translate = translateClient();

export const translateJsonToEdi = async (
  input: unknown,
  guideId: string | undefined,
  envelope: EdiTranslateWriteEnvelope,
  useBuiltInGuide?: boolean
): Promise<string> => {
  console.log({ guideId });

  if (useBuiltInGuide && is997GuidelessJson(input)) {
    const x12ToolsResult = x12Tools.generate997(input, envelope);
    return x12ToolsResult;
  }

  if (guideId === undefined) {
    throw Error(
      "Transaction Configuration must have a guide assigned for writing EDI"
    );
  }

  const translateResult = await translate.send(
    new TranslateJsonToX12Command({
      guideId,
      input: input as DocumentType,
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

const is997GuidelessJson = (input: unknown): input is x12Tools.Ack997 => {
  return (
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    (input as any)?.heading?.transaction_set_header_ST
      ?.transaction_set_identifier_code_01 === "997"
  );
};
