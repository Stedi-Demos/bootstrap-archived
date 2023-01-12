import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import {
  PartnersClient,
  PartnersClientConfig,
} from "@stedi/sdk-client-partners";
import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";

let _partnersClient: PartnersClient;

export const partnersClient = () => {
  if (_partnersClient === undefined) {
    const config: PartnersClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
      maxAttempts: 5,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
    };

    _partnersClient = new PartnersClient(config);
  }

  return _partnersClient;
};
