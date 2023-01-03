import fs from "fs";
import dotenv from "dotenv";

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

// TODO: replace this with dynamic directory listing
export const getEnabledTransactionSets = (): string[] => [
  "X12-5010-850",
  "X12-5010-855",
];

export const functionNameFromPath = (fnPath: string): string => {
  // get function name excluding extension
  // path-a/path-b/path-never-ends/nice/function/handler.ts
  // => nice-function
  return fnPath.split("/").slice(-3, -1).join("-");
};

export const resourceNamespaceFromPath = (path: string): string => {
  // path-a/path-b/path-never-ends/nice/resources/X12/5010/850/map.json
  // => X12-5010-850
  return path.split("/").slice(-4, -1).join("-");
};

export const getFunctionPaths = (pathMatch?: string) => {
  const functionsRoot = "./src/functions";
  const namespaces = fs.readdirSync(functionsRoot);

  const allFunctionPaths = namespaces.reduce((paths: string[], namespace) => {
    if (fs.lstatSync(`${functionsRoot}/${namespace}`).isFile()) return paths;

    return paths.concat(
      getAssetPaths({
        basePath: `${functionsRoot}/${namespace}`,
        fileName: "handler.ts",
      })
    );
  }, []);

  return filterPaths(allFunctionPaths, pathMatch);
};

// gets a set of resource paths for each transaction set in the list
// for example, all map.json or guide.json files across each transaction set
export const getResourcePathsForTransactionSets = (
  transactionSets: string[],
  fileName: string,
  basePath = DEFAULT_RESOURCE_ID_BASE_PATH
) => {
  return transactionSets.flatMap((transactionSet) => {
    const parsedTransactionSet = transactionSet.toUpperCase().split("-");
    if (parsedTransactionSet.length !== 3) {
      console.error(`invalid format transaction set name: ${transactionSet}`);
      process.exit(-1);
    }

    const standard = parsedTransactionSet[0];
    const release = parsedTransactionSet[1];
    const set = parsedTransactionSet[2];
    const pathsForTransactionSet = getAssetPaths({
      basePath: `${basePath}/${standard}/${release}`,
      fileName,
    });
    return filterPaths(pathsForTransactionSet, set);
  });
};

// generic asset path retrieval (internal helper used for getting function
// paths as well as resource paths for transaction sets
const getAssetPaths = (resourceFile: Required<ResourceFile>): string[] => {
  const assets = fs.readdirSync(resourceFile.basePath);

  return assets.reduce((collectedAssets: string[], assetName) => {
    if (
      fs.lstatSync(`${resourceFile.basePath}/${assetName}`).isFile() ||
      !fs.existsSync(
        `${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`
      )
    ) {
      return collectedAssets;
    }

    return collectedAssets.concat(
      `${resourceFile.basePath}/${assetName}/${resourceFile.fileName}`
    );
  }, []);
};

// helper function to filter out paths that don't include the `pathMatch` string, and to check for `no match`
const filterPaths = (paths: string[], pathMatch?: string): string[] => {
  if (pathMatch) paths = paths.filter((path) => path.includes(`/${pathMatch}`));

  if (paths.length === 0) {
    console.error(`No matching assets found. (path filter: ${pathMatch})`);
    process.exit(1);
  }

  return paths;
};

export const updateDotEnvFile = (envVars: dotenv.DotenvParseOutput) => {
  const envVarEntries = Object.entries(envVars).reduce(
    (fileContents: string, [key, value]) => {
      return fileContents.concat(`${key}=${value}\n`);
    },
    ""
  );

  fs.writeFileSync(DEFAULT_DOT_ENV_FILE_PATH, envVarEntries);
};
