import { GetValueCommand, SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../../../lib/clients/stash.js";
import { deployFunctionAtPath } from "../../../lib/functions.js";
import { PARTNERS_KEYSPACE_NAME } from "../../../lib/constants.js";
import { ConfigurationSchema } from "./Configuration.js";
import dotenv from "dotenv";
import { z } from "zod";
import { configurationKey } from "./constants.js";

const environmentVariables = dotenv.config().parsed ?? {};

// change to root directory
process.chdir(new URL("../../../..", import.meta.url).pathname);

const functionName = "billing-usage-poller";

console.log("deploying function");
await deployFunctionAtPath(
  "./src/optional-functions/billing/usage-poller/handler.ts",
  functionName
);

const existingConfig = await stashClient().send(
  new GetValueCommand({
    keyspaceName: PARTNERS_KEYSPACE_NAME,
    key: "billing|usage",
  })
);

if (!existingConfig.value) {
  console.log("deploying stash configuration");
  if (!environmentVariables.DESTINATION_WEBHOOK_URL) {
    console.warn(
      `No DESTINATION_WEBHOOK_URL in .env file. Update Stash keyspace: ${PARTNERS_KEYSPACE_NAME}, key: ${configurationKey} with a destination to enable billing threshold alerts`
    );
  }
  await stashClient().send(
    new SetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: configurationKey,
      value: {
        $schema:
          "https://raw.githubusercontent.com/Stedi-Demos/bootstrap/main/src/optional-functions/billing/usage-poller/configuration.json",

        destinations: process.env.DESTINATION_WEBHOOK_URL
          ? [
              {
                threshold: 5_000,
                destination: {
                  type: "webhook",
                  url: process.env.DESTINATION_WEBHOOK_URL,
                },
              },
            ]
          : [],
      } satisfies z.input<typeof ConfigurationSchema>,
    })
  );
}

console.log("done");
