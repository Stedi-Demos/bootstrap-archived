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
import { ErrorWithContext } from "./errorWithContext.js";

const functions = functionsClient();

type FunctionInvocationId = string;

export const invokeFunction = async (
  functionName: string,
  input: unknown
): Promise<string | undefined> => {
  const invokeFunctionOutput = await functions.send(
    new InvokeFunctionCommand({
      functionName,
      requestPayload: Buffer.from(JSON.stringify(input)),
    })
  );

  const result = invokeFunctionOutput.responsePayload
    ? Buffer.from(invokeFunctionOutput.responsePayload).toString()
    : undefined;

  if (invokeFunctionOutput.invocationError) {
    throw new ErrorWithContext("function invocation error", {
      error: invokeFunctionOutput.invocationError,
      result,
    });
  }

  return result;
};

export const invokeFunctionAsync = async (
  functionName: string,
  input?: unknown
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
  environmentVariables?: Record<string, string>
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
  environmentVariables?: Record<string, string>
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
