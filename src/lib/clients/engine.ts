import { EnginesClient, EnginesClientConfig } from "@stedi/sdk-client-engines";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _engineClient: EnginesClient | undefined;

export const engineClient = () => {
  if (_engineClient === undefined) {
    const config: EnginesClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _engineClient = new EnginesClient(config);
  }

  return _engineClient;
};
