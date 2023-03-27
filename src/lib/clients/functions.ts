import {
  FunctionsClient,
  FunctionsClientConfig,
} from "@stedi/sdk-client-functions";

import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _functionsClient: FunctionsClient | undefined;

export const functionsClient = (): FunctionsClient => {
  if (_functionsClient === undefined) {
    const config: FunctionsClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint =
        "https://functions.cloud.preproduction.stedi.com/2021-11-16";

    _functionsClient = new FunctionsClient(config);
  }

  return _functionsClient;
};
