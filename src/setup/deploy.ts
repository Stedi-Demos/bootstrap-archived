import dotenv from "dotenv";
import { compile, packForDeployment } from "../support/compile.js";
import {
  createFunction,
  createFunctionEventBinding,
  updateFunction,
  updateFunctionEventBinding,
} from "../lib/functions.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";
import { waitUntilFunctionCreateComplete } from "@stedi/sdk-client-functions";
import { functionsClient } from "../lib/clients/functions.js";
import { waitUntilEventToFunctionBindingCreateComplete } from "@stedi/sdk-client-events";
import { DocumentType } from "@aws-sdk/types";
import { eventsClient } from "../lib/clients/events.js";
import { updateResourceMetadata } from "../support/bootstrapMetadata.js";
import { maxWaitTime } from "./contants.js";

const functions = functionsClient();
const events = eventsClient();

const createOrUpdateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: Record<string, string>
) => {
  try {
    await updateFunction(functionName, functionPackage, environmentVariables);
  } catch (e) {
    await createFunction(functionName, functionPackage, environmentVariables);
  }
};

const createOrUpdateEventBinding = async (
  functionName: string,
  eventPattern: DocumentType,
  bindingName: string
) => {
  try {
    await updateFunctionEventBinding(functionName, eventPattern, bindingName);
  } catch (e) {
    await createFunctionEventBinding(functionName, eventPattern, bindingName);
  }
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const functionPaths = getFunctionPaths(process.argv[2]);

  // Ensure that required guides and mappings env vars are defined for all enabled transactions

  const FUNCTION_NAMES: string[] = [];
  let promises: Promise<unknown>[] = functionPaths.map(async (fnPath) => {
    const functionName = functionNameFromPath(fnPath);

    console.log(`Deploying ${functionName}`);

    // compiling function code
    const jsPath = await compile(fnPath);
    const code = await packForDeployment(jsPath);

    // deploying functions
    try {
      const functionPackage = new Uint8Array(code);
      const environmentVariables = dotenv.config().parsed ?? {};
      environmentVariables.NODE_OPTIONS = "--enable-source-maps";
      environmentVariables.STEDI_FUNCTION_NAME = functionName;

      await createOrUpdateFunction(
        functionName,
        functionPackage,
        environmentVariables
      );

      await waitUntilFunctionCreateComplete(
        { client: functions, maxWaitTime },
        { functionName }
      );
      FUNCTION_NAMES.push(functionName);

      console.log(`Done ${functionName}`);
    } catch (e: unknown) {
      console.error(
        `Could not update deploy ${functionName}. Error: ${JSON.stringify(
          e,
          null,
          2
        )}`
      );
    }
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

  console.log("Waiting for event binding deploys to complete");
  await Promise.all(promises);

  await updateResourceMetadata({ EVENT_BINDING_NAMES });

  console.log(`Deploy completed at: ${new Date().toLocaleString()}`);
})();
