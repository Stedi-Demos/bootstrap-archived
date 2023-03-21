import { As2Client, As2ClientConfig } from "@stedi/sdk-client-as2";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _as2Client: As2Client | undefined;

export const as2Client = () => {
  if (_as2Client === undefined) {
    const config: As2ClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _as2Client = new As2Client(config);
  }

  return _as2Client;
};
