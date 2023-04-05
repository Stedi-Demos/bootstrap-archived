import { EventsClient, EventsClientConfig } from "@stedi/sdk-client-events";

import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _eventsClient: EventsClient | undefined;

export const eventsClient = (): EventsClient => {
  if (_eventsClient === undefined) {
    const config: EventsClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _eventsClient = new EventsClient(config);
  }

  return _eventsClient;
};
