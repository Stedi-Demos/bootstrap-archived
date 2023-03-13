import {
  CreateFunctionCommand,
  CreateFunctionCommandOutput,
  DeleteFunctionCommand,
  DeleteFunctionCommandOutput,
  InvokeFunctionCommand,
  UpdateFunctionCommand,
  UpdateFunctionCommandOutput,
} from "@stedi/sdk-client-functions";
import { functionsClient } from "./clients/functions.js";

const functions = functionsClient();

type FunctionInvocationId = string;

export const invokeFunction = async (
  functionName: string,
  input: any
): Promise<string | undefined> => {
  const result = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      requestPayload: Buffer.from(JSON.stringify(input)),
    })
  );

  return result.responsePayload
    ? Buffer.from(result.responsePayload).toString()
    : undefined;
};

export const invokeFunctionAsync = async (
  functionName: string,
  input?: any
): Promise<FunctionInvocationId> => {
  const requestPayload = input ? Buffer.from(JSON.stringify(input)) : undefined;

  const { functionInvocationId } = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      invocationType: "Event",
      requestPayload,
      contentType: "application/json",
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return functionInvocationId!;
};

export const createFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
): Promise<CreateFunctionCommandOutput> => {
  return functions.send(
    new CreateFunctionCommand({
      functionName,
      package: functionPackage,
      environmentVariables,
      timeout: 900,
    })
  );
};

export const updateFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
): Promise<UpdateFunctionCommandOutput> => {
  return functions.send(
    new UpdateFunctionCommand({
      functionName,
      package: functionPackage,
      environmentVariables,
      timeout: 900,
    })
  );
};

export const deleteFunction = async (
  functionName: string
): Promise<DeleteFunctionCommandOutput> => {
  return functions.send(
    new DeleteFunctionCommand({
      functionName,
    })
  );
};
