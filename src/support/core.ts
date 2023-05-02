import { coreClient } from "../lib/clients/cores.js";
import {
  DescribeCoreCommand,
  UpdateCoreCommand,
  waitUntilCoreUpdateComplete,
} from "@stedi/sdk-client-cores";
import { maxWaitTime } from "./contants.js";

import { updateResourceMetadata } from "./bootstrapMetadata.js";
import dotenv from "dotenv";
import { updateDotEnvFile } from "./utils.js";

const core = coreClient();

export const coreName = "default";

export const ensureCoreIsRunning = async () => {
  try {
    const deployedCore = await core.send(new DescribeCoreCommand({ coreName }));
    await updateResourceMetadata({
      CORE_INGESTION_BUCKET_NAME: deployedCore.inboxEdiBucketName!,
    });

    const existingEnvVars = dotenv.config().parsed ?? {};
    updateDotEnvFile({
      ...existingEnvVars,
      ...{ CORE_INGESTION_BUCKET_NAME: deployedCore.inboxEdiBucketName! },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    ) {
      console.warn(
        "Fatal: Core is not enabled in this account. Visit https://www.stedi.com/app/engine/file-executions to enable Core."
      );
      process.exit(1);
    } else {
      throw error;
    }
  }
};

export const upgradeCore = async () => {
  await core.send(new UpdateCoreCommand({ coreName }));

  const update = await core.send(new DescribeCoreCommand({ coreName }));

  if (update.resourceDetail?.status === "UNDER_CHANGE")
    console.log("Checking for core updates...");
  else {
    console.log("Issue starting update");
    return false;
  }

  const upgrade = await waitUntilCoreUpdateComplete(
    { client: core, maxWaitTime },
    { coreName }
  );

  return upgrade.state === "SUCCESS";
};
