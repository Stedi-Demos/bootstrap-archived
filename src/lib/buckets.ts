import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { BucketsClient, BucketsClientConfig } from "@stedi/sdk-client-buckets";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";

let _bucketClient: BucketsClient;

export const bucketClient = () => {
  if (_bucketClient === undefined) {
    const config: BucketsClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
      maxAttempts: 5,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
      // apiKey and endpoint are required in Functions environment for control plane calls
      endpoint: `https://buckets.cloud.us.stedi.com/2022-05-05`,
    };

    _bucketClient = new BucketsClient(config);
  }

  return _bucketClient;
};
