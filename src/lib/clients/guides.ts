import { GuidesClient, GuidesClientConfig } from "@stedi/sdk-client-guides";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _guidesClient: GuidesClient | undefined;

export const guidesClient = () => {
  if (_guidesClient === undefined) {
    const config: GuidesClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint = "https://guides.us.preproduction.stedi.com/2022-03-09";

    _guidesClient = new GuidesClient(config);
  }

  return _guidesClient;
};
