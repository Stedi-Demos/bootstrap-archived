import { BucketsClient, BucketsClientConfig } from "@stedi/sdk-client-buckets";

import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _bucketClient: BucketsClient | undefined;

export const bucketsClient = () => {
  if (_bucketClient === undefined) {
    const config: BucketsClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint =
        "https://buckets.cloud.us.preproduction.stedi.com/2022-05-05";

    _bucketClient = new BucketsClient(config);
  }

  return _bucketClient;
};
