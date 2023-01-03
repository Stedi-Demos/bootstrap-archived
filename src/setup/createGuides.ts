import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { CreateGuideInput } from "@stedi/sdk-client-guides";

import {
  getEnabledTransactionSets,
  getResourcePathsForTransactionSets,
  resourceNamespaceFromPath,
  updateDotEnvFile,
} from "../support/utils.js";
import { ensureGuideExists } from "../support/guide.js";

dotenv.config({ override: true });

export const createGuides = async () => {
  const guidePaths = getResourcePathsForTransactionSets(
    getEnabledTransactionSets(),
    "guide.json"
  );

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

  const result = await Promise.all(promises);

  return result;
};
