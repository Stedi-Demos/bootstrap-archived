import dotenv from "dotenv";

import { compile, packForDeployment } from "../support/compile.js";
import { createFunction, updateFunction } from "../support/functions.js";
import { functionNameFromPath, getFunctionPaths, } from "../support/utils.js";

dotenv.config({ override: true });

const createOrUpdateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
) => {
  try {
    await updateFunction(functionName, functionPackage, environmentVariables);
  } catch (e) {
    await createFunction(functionName, functionPackage, environmentVariables);
  }
};

(async () => {
  const functionPaths = getFunctionPaths(process.argv[2]);

  const promises = functionPaths.map(async (fnPath) => {
    const functionName = functionNameFromPath(fnPath);

    console.log(`Deploying ${functionName}`);

    const jsPath = await compile(fnPath);
    const code = await packForDeployment(jsPath);

    try {
      const functionPackage = new Uint8Array(code);
      const environmentVariables = dotenv.config().parsed ?? {};
      environmentVariables["NODE_OPTIONS"] = "--enable-source-maps";
      environmentVariables["STEDI_FUNCTION_NAME"] = functionName;

      const result = await createOrUpdateFunction(
        functionName,
        functionPackage,
        environmentVariables
      );

      console.log(`Done ${functionName}`);

      return result;
    } catch (e) {
      console.error(`Could not update deploy ${functionName}. Error ${e}`);
    }
  });

  await Promise.all(promises);

  console.log(`Deploy completed at: ${new Date().toLocaleString()}`);
})();
