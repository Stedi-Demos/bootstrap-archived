import dotenv from "dotenv";
import { compile, packForDeployment } from "../support/compile.js";
import {
  createFunction,
  deleteFunction,
  updateFunction,
} from "../lib/functions.js";
import { functionNameFromPath, getFunctionPaths } from "../support/utils.js";
import {
  waitUntilFunctionCreateComplete,
  waitUntilFunctionDeleteComplete,
} from "@stedi/sdk-client-functions";
import { functionsClient } from "../lib/clients/functions.js";

const functions = functionsClient();

const createOrUpdateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
) => {
  // try {
  //   await updateFunction(functionName, functionPackage, environmentVariables);
  // } catch (e) {
  console.log("Deleting function: ", functionName);
  await deleteFunction(functionName);
  await waitUntilFunctionDeleteComplete(
    { client: functions, maxWaitTime: 90 },
    { functionName }
  );
  console.log("Create function: ", functionName);
  await createFunction(functionName, functionPackage, environmentVariables);
  // }
};

(async () => {
  const functionPaths = getFunctionPaths(process.argv[2]);

  // Ensure that required guides and mappings env vars are defined for all enabled transactions

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

      await createOrUpdateFunction(
        functionName,
        functionPackage,
        environmentVariables
      );

      await waitUntilFunctionCreateComplete(
        { client: functions, maxWaitTime: 90 },
        { functionName }
      );

      console.log(`Done ${functionName}`);
    } catch (e) {
      console.error(`Could not update deploy ${functionName}. Error ${e}`);
    }
  });

  await Promise.all(promises);

  console.log(`Deploy completed at: ${new Date().toLocaleString()}`);
})();
