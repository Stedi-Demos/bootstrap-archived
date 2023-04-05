import { coreClient } from "../lib/clients/cores.js";
import {
  CreateCoreCommand,
  DescribeCoreCommand,
  UpdateCoreCommand,
  waitUntilCoreCreateComplete,
  waitUntilCoreUpdateComplete,
} from "@stedi/sdk-client-cores";
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

const core = coreClient();
const buckets = bucketsClient();

export const coreName = "default";

export const ensureCoreIsRunning = async () => {
  try {
    await core.send(new DescribeCoreCommand({ coreName }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    ) {
      const bucketName = `${coreName}-core-ingestion-${randomBytes(6).toString(
        "hex"
      )}`;

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

      await core.send(
        new CreateCoreCommand({
          coreName,
          inboxEdiBucketName: bucketName,
        })
      );

      await waitUntilCoreCreateComplete(
        { client: core, maxWaitTime },
        { coreName }
      );

      await updateResourceMetadata({
        CORE_INGESTION_BUCKET_NAME: bucketName,
      });

      const existingEnvVars = dotenv.config().parsed ?? {};
      updateDotEnvFile({
        ...existingEnvVars,
        ...{ CORE_INGESTION_BUCKET_NAME: bucketName },
      });
    } else {
      console.log(error);
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
