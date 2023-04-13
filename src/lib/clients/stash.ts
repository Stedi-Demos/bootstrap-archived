import {
  GetValueCommand,
  StashClient,
  StashClientConfig,
} from "@stedi/sdk-client-stash";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";
import { ErrorFromStashConfiguration } from "../errorFromStashConfiguration.js";

let _stashClient: StashClient | undefined;

export const stashClient = () => {
  if (_stashClient === undefined) {
    const config: StashClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint = "https://stash.us.preproduction.stedi.com/2022-04-20";

    _stashClient = new StashClient(config);
  }

  return _stashClient;
};

export const getRequiredValue = async (keyspaceName: string, key: string) => {
  const result = await stashClient().send(
    new GetValueCommand({
      keyspaceName,
      key,
    })
  );

  if (!result.value) {
    throw new ErrorFromStashConfiguration(key, {
      error: { issues: [{ message: "Required key not found in stash" }] },
    });
  }

  return result.value;
};
