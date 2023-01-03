import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { StashClient, StashClientConfig } from "@stedi/sdk-client-stash";
import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";

let _stashClient: StashClient;

export const stashClient = () => {
  if (_stashClient === undefined) {
    const config: StashClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
      maxAttempts: 5,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    _stashClient = new StashClient(config);
  }

  return _stashClient;
};
