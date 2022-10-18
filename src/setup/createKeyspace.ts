import dotenv from "dotenv";

import { CreateKeyspaceCommand, StashClient } from "@stedi/sdk-client-stash";

import { DEFAULT_SDK_CLIENT_PROPS } from "../lib/constants.js";

dotenv.config({ override: true });

(async () => {
  const stashClient = new StashClient({
    ...DEFAULT_SDK_CLIENT_PROPS,
    endpoint: "https://stash.us.stedi.com/2022-04-20",
  });

  const result = await stashClient.send(
    new CreateKeyspaceCommand({
      keyspaceName: "outbound-control-numbers",
    })
  );

  console.log(result.status);
})();
