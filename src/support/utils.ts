import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import {
  getEnvVarNameForResource,
  getEnvVarSuffixForResourceType,
  requiredEnvVar,
  ResourceType
} from "../lib/environment.js";

const DEFAULT_RESOURCE_ID_BASE_PATH = "./src/resources";
const DEFAULT_DOT_ENV_FILE_PATH = "./.env";

type ResourceFile = {
  basePath: string;
  fileName?: string;
};

export type ResourceDetails = {
  name: string;
  id: string;
};

export const functionNameFromPath = (fnPath: string): string => {
  // get function name excluding extension
  // path-a/path-b/path-never-ends/nice/function/handler.ts
  // => nice-function
  return fnPath.split("/").slice(-3, -1).join("-");
};

export const resourceNamespaceFromPath = (path: string): string => {
  // path-a/path-b/path-never-ends/nice/resources/X12-850/map.json
  // => read
  return path.split('/').slice(-2, -1)[0];
}

export const getFunctionPaths = (pathMatch?: string) => {
  const functionsRoot = "./src/functions";
  const namespaces = fs.readdirSync(functionsRoot);

  const allFunctionPaths = namespaces.reduce(
    (paths: string[], namespace) => {
    if (fs.lstatSync(`${functionsRoot}/${namespace}`).isFile()) return paths;

    return paths.concat(getAssetPaths({ basePath: `${functionsRoot}/${namespace}`, fileName: "handler.ts" }));
  }, []);

  return filterPaths(allFunctionPaths, pathMatch);
};

export const getEnabledTransactionSets = (): string[] => {
  const enabledTransactionSetsList = requiredEnvVar("ENABLED_TRANSACTION_SETS");
  return enabledTransactionSetsList.split(",");
}

// gets a set of resource paths for each transaction set in the list
// for example, all map.json or guide.json files across each transaction set
export const getResourcePathsForTransactionSets = (
  transactionSets: string[],
  fileName: string,
  basePath = DEFAULT_RESOURCE_ID_BASE_PATH)  => {
  const allResourcePaths = getAssetPaths({ basePath, fileName });
  return transactionSets.flatMap((txnSet) => filterPaths(allResourcePaths, txnSet));
}

// generic asset path retrieval (internal helper used for getting function
// paths as well as resource paths for transaction sets
const getAssetPaths = (resourceFile: Required<ResourceFile>): string[] => {
  const assets = fs.readdirSync(resourceFile.basePath);

  return assets.reduce((collectedAssets: string[], assetName) => {
      if (fs.lstatSync(`${resourceFile.basePath}/${assetName}`).isFile() ||
        !fs.existsSync(`${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`)) {
        return collectedAssets;
      }

      return collectedAssets.concat(`${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`);
  }, []);
}

// helper function to filter out paths that don't include the `pathMatch` string, and to check for `no match`
const filterPaths = (paths: string[], pathMatch?: string): string[] => {
  if (pathMatch) paths = paths.filter((path) => path.includes(`/${pathMatch}`));

  if (paths.length === 0) {
    console.error(`No matching assets found. (path filter: ${pathMatch})`);
    process.exit(1);
  }

  return paths;
}

// helper function to generate resource id env var entries for a set of resources
export const generateResourceIdEnvVars = (
  resourceType: ResourceType,
  resourceDetails: ResourceDetails[],
): dotenv.DotenvParseOutput => {
  const envVarEntries = resourceDetails.map((resourceDetailItem) => {
    const resourceEnvVarName = getEnvVarNameForResource(resourceType, resourceDetailItem.name);
    return [resourceEnvVarName, resourceDetailItem.id];
  });

  return Object.fromEntries(envVarEntries);
};

// helper function to remove resource id env vars for a particular resource type from the existing env vars
export const removeExistingResourceIdEnvVars = (
  resourceType: ResourceType,
  existingEnvVars?: dotenv.DotenvParseOutput
): dotenv.DotenvParseOutput => {
  if (!existingEnvVars) {
    return {};
  }

  const suffix = getEnvVarSuffixForResourceType(resourceType);
  const updatedEnvVars = Object.entries(existingEnvVars).reduce((updatedEntries: string[][], [key, value]) => {
    // only keep env vars that don't end with resource-type suffix
    if (!key.includes(suffix)) {
      updatedEntries.push([key, value]);
    }

    return updatedEntries;
  }, []);

  return Object.fromEntries(updatedEnvVars);
}

export const updateDotEnvFile = (envVars: dotenv.DotenvParseOutput) => {
  const envVarEntries = Object.entries(envVars).reduce((fileContents: string, [key, value]) => {
    return fileContents.concat(`${key}=${value}\n`);
  }, "");

  fs.writeFileSync(DEFAULT_DOT_ENV_FILE_PATH, envVarEntries);
};

export const printResourceEnvVarSummary = (resourceType: ResourceType, resourceEnvEntries: dotenv.DotenvParseOutput) => {
  const entries = Object.entries(resourceEnvEntries);
  const count = entries.length;
  console.log(`\nUpdated ${path.basename(DEFAULT_DOT_ENV_FILE_PATH)} file with ${count} ${resourceType} ${count > 1 ? "entries" : "entry"}:\n`);

  entries.forEach(([key, value]) => {
    console.log(`${key}=${value}`);
  });
};
