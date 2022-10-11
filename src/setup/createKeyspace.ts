import dotenv from "dotenv";

import { CreateKeyspaceCommand, StashClient } from "@stedi/sdk-client-stash";

dotenv.config({ override: true });

(async () => {
  const stashClient = new StashClient({
    region: "us-east-1",
    endpoint: "https://stash.us.stedi.com/2022-04-20",
    apiKey: process.env.STEDI_API_KEY,
  });

  const result = await stashClient.send(
    new CreateKeyspaceCommand({
      keyspaceName: "outbound-control-numbers",
    })
  );

  console.log(result.status);
})();
