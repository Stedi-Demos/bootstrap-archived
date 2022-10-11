import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateGuideInput } from "@stedi/sdk-client-guides";

import {
  generateResourceIdEnvVars,
  getEnabledTransactionSets,
  getResourcePathsForTransactionSets,
  printResourceEnvVarSummary,
  removeExistingResourceIdEnvVars,
  resourceNamespaceFromPath,
  updateDotEnvFile,
} from "../support/utils.js";
import { ensureGuideExists } from "../support/guide.js";

dotenv.config({ override: true });

(async () => {
  const guidePaths = getResourcePathsForTransactionSets(getEnabledTransactionSets(), "guide.json");

  const promises = guidePaths.map(async (guidePath) => {
    const namespace = resourceNamespaceFromPath(guidePath);

    const rawGuide = fs.readFileSync(
      path.join(process.cwd(), guidePath),
      "utf8"
    );

    const guide = JSON.parse(rawGuide) as CreateGuideInput;
    console.log(`[${namespace}] Creating guide with name: "${guide.name}"`);

    const guideId = await ensureGuideExists(namespace, guide);
    return { name: namespace, id: guideId };
  });

  const guidesDetails = await Promise.all(promises);
  const guideIdEnvVars = generateResourceIdEnvVars("guide", guidesDetails);
  const existingEnvVars = removeExistingResourceIdEnvVars("guide", dotenv.config().parsed);
  updateDotEnvFile({
    ...existingEnvVars,
    ...guideIdEnvVars,
  });
  console.log(`\nDone.`);
  printResourceEnvVarSummary("guide", guideIdEnvVars);
})();
