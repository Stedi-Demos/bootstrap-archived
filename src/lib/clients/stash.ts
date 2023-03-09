import { StashClient, StashClientConfig } from "@stedi/sdk-client-stash";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _stashClient: StashClient;

export const stashClient = () => {
  console.log({ _stashClient });
  if (_stashClient === undefined) {
    console.log("_stashClient is undefined");
    const config: StashClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env["USE_PREVIEW"] !== undefined)
      config.endpoint = "https://stash.us.preproduction.stedi.com/2022-04-20";

    console.log({ config });
    _stashClient = new StashClient(config);
  }

  console.log("before returning _stashClient");

  return _stashClient;
};
