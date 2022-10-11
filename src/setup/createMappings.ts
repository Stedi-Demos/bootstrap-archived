import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateMappingCommandInput } from "@stedi/sdk-client-mappings";

import {
  generateResourceIdEnvVars,
  getEnabledTransactionSets,
  getResourcePathsForTransactionSets,
  printResourceEnvVarSummary,
  removeExistingResourceIdEnvVars,
  resourceNamespaceFromPath,
  updateDotEnvFile,
} from "../support/utils.js";
import { ensureMappingExists } from "../support/mapping.js";

dotenv.config({ override: true });

(async () => {
  const mappingPaths = getResourcePathsForTransactionSets(getEnabledTransactionSets(), "map.json");

  const promises = mappingPaths.map(async (mappingPath) => {
    const namespace = resourceNamespaceFromPath(mappingPath);

    const rawMapping = fs.readFileSync(
      path.join(process.cwd(), mappingPath),
      "utf8"
    );

    const mapping = JSON.parse(rawMapping) as CreateMappingCommandInput;
    console.log(`[${namespace}] Creating mapping with name: "${mapping.name}"`);

    const mappingId = await ensureMappingExists(namespace, mapping);
    return { name: namespace, id: mappingId };
  }, []);

  const mappingsDetails = await Promise.all(promises);
  const mappingIdEnvVars = generateResourceIdEnvVars("mapping", mappingsDetails);
  const existingEnvVars = removeExistingResourceIdEnvVars("mapping", dotenv.config().parsed);
  updateDotEnvFile({
    ...existingEnvVars,
    ...mappingIdEnvVars,
  });

  console.log(`\nDone.`);
  printResourceEnvVarSummary("mapping", mappingIdEnvVars);
})();
