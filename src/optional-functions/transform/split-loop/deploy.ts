import dotenv from "dotenv";
import {
  deployEventBinding,
  deployFunctionAtPath,
} from "../../../lib/functions.js";

// change to root directory
process.chdir(new URL("../../../..", import.meta.url).pathname);

const environmentVariables = dotenv.config().parsed ?? {};

if (!environmentVariables.CORE_INGESTION_BUCKET_NAME) {
  throw new Error(
    "split-loop function requires 'CORE_INGESTION_BUCKET_NAME' variable to be set in .env. Update .env to include the bucket name"
  );
}

const functionName = "transform-split-loop";
const eventBindingName = "split-failed-file-loop";

await deployFunctionAtPath(
  "./src/optional-functions/transform/split-loop/handler.ts",
  functionName
);

await deployEventBinding(
  functionName,
  {
    source: ["stedi.core"],
    "detail-type": ["file.failed"],
    detail: {
      direction: ["RECEIVED"],
      input: {
        type: ["EDI/X12"],
      },
    },
  },
  eventBindingName
);
