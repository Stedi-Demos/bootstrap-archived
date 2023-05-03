import { getFunctionPaths } from "../support/utils.js";
import { waitUntilEventToFunctionBindingCreateComplete } from "@stedi/sdk-client-events";
import { eventsClient } from "../lib/clients/events.js";
import { updateResourceMetadata } from "../support/bootstrapMetadata.js";
import {
  createOrUpdateEventBinding,
  deployFunctionAtPath,
} from "../lib/functions.js";
import { maxWaitTime } from "../support/contants.js";

const events = eventsClient();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const functionPaths = getFunctionPaths(process.argv[2]);

  // Ensure that required guides and mappings env vars are defined for all enabled transactions

  const FUNCTION_NAMES: string[] = [];
  let promises: Promise<unknown>[] = functionPaths.map(async (fnPath) => {
    const functionName = await deployFunctionAtPath(
      fnPath as `./src/${string}/handler.ts`
    );
    FUNCTION_NAMES.push(functionName);
  });

  console.log("Waiting for function deploys to complete");
  await Promise.all(promises);

  await updateResourceMetadata({ FUNCTION_NAMES });

  promises = [];
  console.log(`Creating event bindings`);

  // deploying event bindings
  //
  const EVENT_BINDING_NAMES: string[] = [];
  await createOrUpdateEventBinding(
    "edi-inbound",
    {
      source: ["stedi.core"],
      "detail-type": ["transaction.processed"],
      detail: {
        direction: ["RECEIVED"],
      },
    },
    "all-received-txns"
  );
  EVENT_BINDING_NAMES.push("all-received-txns");

  promises.push(
    waitUntilEventToFunctionBindingCreateComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName: "all-received-txns" }
    )
  );

  await createOrUpdateEventBinding(
    "edi-acknowledgment",
    {
      source: ["stedi.core"],
      "detail-type": ["functional_group.processed"],
      detail: {
        direction: ["RECEIVED"],
      },
    },
    "all-received-functional-groups"
  );
  EVENT_BINDING_NAMES.push("all-received-functional-groups");

  promises.push(
    waitUntilEventToFunctionBindingCreateComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName: "all-received-functional-groups" }
    )
  );

  await createOrUpdateEventBinding(
    "events-file-error",
    {
      source: ["stedi.core"],
      "detail-type": ["file.failed"],
    },
    "core-file-errors"
  );
  EVENT_BINDING_NAMES.push("core-file-errors");

  promises.push(
    waitUntilEventToFunctionBindingCreateComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName: "core-file-errors" }
    )
  );

  await createOrUpdateEventBinding(
    "csv-from-json",
    {
      source: ["stedi.core"],
      "detail-type": ["file.processed"],
      detail: {
        source: {
          type: ["JSON"],
        },
      },
    },
    "all-processed-json-files"
  );
  EVENT_BINDING_NAMES.push("all-processed-json-files");

  promises.push(
    waitUntilEventToFunctionBindingCreateComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName: "all-processed-json-files" }
    )
  );

  await createOrUpdateEventBinding(
    "csv-to-json",
    {
      source: ["stedi.core"],
      "detail-type": ["file.processed"],
      detail: {
        source: {
          type: ["CSV"],
        },
      },
    },
    "all-processed-csv-files"
  );
  EVENT_BINDING_NAMES.push("all-processed-csv-files");

  promises.push(
    waitUntilEventToFunctionBindingCreateComplete(
      { client: events, maxWaitTime },
      { eventToFunctionBindingName: "all-processed-csv-files" }
    )
  );

  console.log("Waiting for event binding deploys to complete");
  await Promise.all(promises);

  await updateResourceMetadata({ EVENT_BINDING_NAMES });

  console.log(`Deploy completed at: ${new Date().toLocaleString()}`);
})();
