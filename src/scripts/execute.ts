import { InvocationType } from "@stedi/sdk-client-functions";
import { invokeFunction } from "../lib/functions.js";

// if input was provided, parse as object or string, otherwise return undefined
const processFunctionInput = (input?: string) => {
  return input ? parsedObjectOrString(input) : input;
};

// parse input as object if possible, otherwise leave as string
const parsedObjectOrString = (input: string) => {
  let result: string | object = input;
  try {
    result = JSON.parse(input) as string | object;
  } catch (e) {
    // no-op
  }

  return result;
};

void (async () => {
  const functionName = process.argv[2];
  if (!functionName || functionName.trim().startsWith("--")) {
    console.error("The function name must be the first argument provided.");
    process.exit(1);
  }

  const isAsync = process.argv[3] === "--async";
  const inputArg = isAsync ? process.argv[4] : process.argv[3];
  const input = processFunctionInput(inputArg);

  const invocationType = isAsync
    ? InvocationType.ASYNCHRONOUS
    : InvocationType.SYNCHRONOUS;

  console.log(`Invoking function '${functionName}' with invocation type: ${invocationType}.`);
  const response = await invokeFunction(functionName, input);

  const resultsOutput = response
    ? JSON.stringify(response, null, 2)
    : undefined;

  console.log("Result:");
  console.group();
  console.log(resultsOutput);
  console.groupEnd();
})();