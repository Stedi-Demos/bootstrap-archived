import { engineClient } from "../lib/clients/engine.js";
import {
  CreateEngineCommand,
  DeleteEngineCommand,
  DescribeEngineCommand,
  UpdateEngineCommand,
  waitUntilEngineCreateComplete,
  waitUntilEngineUpdateComplete,
} from "@stedi/sdk-client-engines";
import { maxWaitTime } from "../setup/contants.js";
import {
  CreateBucketCommand,
  waitUntilBucketCreateComplete,
} from "@stedi/sdk-client-buckets";
import { bucketsClient } from "../lib/clients/buckets.js";
import { randomBytes } from "crypto";
import { updateResourceMetadata } from "./bootstrapMetadata.js";
import dotenv from "dotenv";
import { updateDotEnvFile } from "./utils.js";

const engine = engineClient();
const buckets = bucketsClient();

export const engineName = "default";

export const ensureEngineIsRunning = async () => {
  try {
    await engine.send(new DescribeEngineCommand({ engineName }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    ) {
      const bucketName = `${engineName}-engine-ingestion-${randomBytes(
        6
      ).toString("hex")}`;

      await buckets.send(
        new CreateBucketCommand({
          bucketName,
        })
      );
      await waitUntilBucketCreateComplete(
        {
          client: buckets,
          maxWaitTime: 450,
        },
        {
          bucketName,
        }
      );

      await engine.send(
        new CreateEngineCommand({
          engineName,
          inboxEdiBucketName: bucketName,
        })
      );

      await waitUntilEngineCreateComplete(
        { client: engine, maxWaitTime },
        { engineName }
      );

      await updateResourceMetadata({
        ENGINE_INGESTION_BUCKET_NAME: bucketName,
      });

      const existingEnvVars = dotenv.config().parsed ?? {};
      updateDotEnvFile({
        ...existingEnvVars,
        ...{ ENGINE_INGESTION_BUCKET_NAME: bucketName },
      });
    } else {
      console.log(error);
    }
  }
};

export const upgradeEngine = async () => {
  await engine.send(new UpdateEngineCommand({ engineName }));

  const update = await engine.send(new DescribeEngineCommand({ engineName }));

  if (update.resourceDetail?.status === "UNDER_CHANGE")
    console.log("Checking for engine updates...");
  else {
    console.log("Issue starting update");
    return false;
  }

  const upgrade = await waitUntilEngineUpdateComplete(
    { client: engine, maxWaitTime },
    { engineName }
  );

  return upgrade.state === "SUCCESS";
};

export const deleteEngine = async () => {
  return engine.send(new DeleteEngineCommand({ engineName }));
};
