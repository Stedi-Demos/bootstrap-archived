import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import {
  EDITranslateClient,
  EDITranslateClientConfig,
  Parsed,
  TranslateJsonToX12Command,
  TranslateX12ToJsonCommand,
} from "@stedi/sdk-client-edi-translate";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { DocumentType } from "@aws-sdk/types";

let _translateClient: EDITranslateClient | undefined;

export const translateClient = () => {
  if (_translateClient === undefined) {
    const config: EDITranslateClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
      endpoint: "https://edi-translate.us.stedi.com/2022-01-01",
      maxAttempts: 5,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    _translateClient = new EDITranslateClient(config);
  }

  return _translateClient;
};

export const translateJsonToEdi = async (
  input: unknown,
  guideId: string,
  envelope: unknown
): Promise<string> => {
  const translateResult = await translateClient().send(
    new TranslateJsonToX12Command({
      guideId,
      input: input as DocumentType,
      envelope: envelope as DocumentType,
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
