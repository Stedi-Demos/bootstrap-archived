import { invokeFunction, invokeFunctionAsync } from "../lib/functions.js";

// if input was provided, parse as object or string, otherwise return undefined
const processFunctionInput = (input?: string) => {
  return input ? parsedObjectOrString(input) : input;
};

// parse input as object if possible, otherwise leave as string
const parsedObjectOrString = (input: string) => {
  let result = input;
  try {
    result = JSON.parse(input);
  } catch (e) {
    // no-op
  }

  return result;
};

void (async () => {
  const functionName = process.argv[2];
  if (functionName === undefined || functionName.trim().startsWith("--")) {
    console.error("The function name must be the first argument provided.");
    process.exit(1);
  }

  const isAsync = process.argv[3] === "--async";
  const inputArg = isAsync ? process.argv[4] : process.argv[3];
  const input = processFunctionInput(inputArg);

  if (isAsync) {
    console.log(`Invoking function '${functionName}' asynchronously.`);
    await invokeFunctionAsync(functionName, input);
  } else {
    console.log(`Invoking function '${functionName}' synchronously.`);
    const response = await invokeFunction(functionName, input);

    let result: any;
    try {
      // if response payload is present, try to parse as JSON
      result = response
        ? JSON.parse(response)
        : undefined;
    } catch (e) {
      // if response is not JSON, leave it as-is
      result = response;
    }

    console.log("Result:");
    console.group();
    console.log(JSON.stringify(result, null, 2));
    console.groupEnd();
  }
})();
