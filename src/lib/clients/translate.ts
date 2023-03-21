import {
  EDITranslateClient,
  EDITranslateClientConfig,
} from "@stedi/sdk-client-edi-translate";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _translateClient: EDITranslateClient | undefined;

export const translateClient = () => {
  if (_translateClient === undefined) {
    const config: EDITranslateClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint =
        "https://edi-translate.us.preproduction.stedi.com/2022-01-01";

    _translateClient = new EDITranslateClient(config);
  }

  return _translateClient;
};
