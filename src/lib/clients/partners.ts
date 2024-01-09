import {
  PartnersClient,
  PartnersClientConfig,
} from "@stedi/sdk-client-partners";
import { requiredEnvVar } from "../environment.js";
import { NodeHttpHandler } from "@smithy/node-http-handler";

let _partnersClient: PartnersClient | undefined;

export const partnersClient = () => {
  if (_partnersClient === undefined) {
    const config: PartnersClientConfig = {
      apiKey: requiredEnvVar("STEDI_API_KEY"),
      region: "us",
      maxAttempts: 5,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5_000,
      }),
      endpoint: "https://core.us.stedi.com/2023-08-01",
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint = "https://core.us.preproduction.stedi.com/2023-08-01";

    _partnersClient = new PartnersClient(config);
  }

  return _partnersClient;
};
