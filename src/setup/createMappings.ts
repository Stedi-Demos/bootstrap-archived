import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateMappingCommandInput } from "@stedi/sdk-client-mappings";

import {
  getEnabledTransactionSets,
  getResourcePathsForTransactionSets,
  resourceNamespaceFromPath,
} from "../support/utils.js";
import { ensureMappingExists } from "../support/mapping.js";

dotenv.config({ override: true });

export const createMappings = async () => {
  const mappingPaths = getResourcePathsForTransactionSets(
    getEnabledTransactionSets(),
    "map.json"
  );

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

  const result = await Promise.all(promises);

  return result;
};
