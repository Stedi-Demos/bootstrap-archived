import {
  PartnersClient,
  PartnersClientConfig,
} from "@stedi/sdk-client-partners";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _partnersClient: PartnersClient | undefined;

export const partnersClient = () => {
  if (_partnersClient === undefined) {
    const config: PartnersClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined)
      config.endpoint =
        "https://partners.us.preproduction.stedi.com/2022-01-01";

    _partnersClient = new PartnersClient(config);
  }

  return _partnersClient;
};
