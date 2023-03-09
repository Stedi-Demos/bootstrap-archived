import { StashClient, StashClientConfig } from "@stedi/sdk-client-stash";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _stashClient: StashClient;

export const stashClient = () => {
  if (_stashClient === undefined) {
    const config: StashClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env["USE_PREVIEW"] !== undefined)
      config.endpoint = "https://stash.us.preproduction.stedi.com/2022-04-20";

    _stashClient = new StashClient(config);
  }

  return _stashClient;
};
