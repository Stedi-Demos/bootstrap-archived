import { CoresClient, CoresClientConfig } from "@stedi/sdk-client-cores";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _coresClient: CoresClient | undefined;

export const coreClient = () => {
  if (_coresClient === undefined) {
    const config: CoresClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _coresClient = new CoresClient(config);
  }

  return _coresClient;
};
