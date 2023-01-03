import dotenv from "dotenv";

import {
  CreateKeyspaceCommand,
  SetValueCommand,
  StashClient,
} from "@stedi/sdk-client-stash";

import {
  DEFAULT_SDK_CLIENT_PROPS,
  ROUTING_KEYSPACE_NAME,
} from "../lib/constants.js";
import { createGuides } from "./createGuides.js";
import { createMappings } from "./createMappings.js";
import { requiredEnvVar } from "../lib/environment.js";

dotenv.config({ override: true });

(async () => {
  const stashClient = new StashClient({
    ...DEFAULT_SDK_CLIENT_PROPS,
    endpoint: "https://stash.us.stedi.com/2022-04-20",
  });

  try {
    await stashClient.send(
      new CreateKeyspaceCommand({
        keyspaceName: ROUTING_KEYSPACE_NAME,
      })
    );
  } catch (e) {
    console.log("Keyspace already exists", typeof e);
  }

  const guides = await createGuides();
  const mappings = await createMappings();

  const namespaces = guides.map(({ name }) => name);

  for (const namespace of namespaces) {
    await stashClient.send(
      new SetValueCommand({
        keyspaceName: ROUTING_KEYSPACE_NAME,
        key: `inbound/${namespace.replace(/-/g, "/")}`,
        value: [
          {
            guideId: guides.find((guide) => guide.name === namespace)!.id,
            mappingId: mappings.find((mapping) => mapping.name === namespace)!
              .id,
            destination: { url: requiredEnvVar("DESTINATION_WEBHOOK_URL") },
          },
        ],
      })
    );
  }
})();
