import { TextEncoder } from "util";

import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import {
  CreateFunctionCommand,
  CreateFunctionCommandOutput,
  DeleteFunctionCommand,
  DeleteFunctionCommandOutput,
  FunctionsClient,
  FunctionsClientConfig,
  InvokeFunctionCommand,
  UpdateFunctionCommand,
  UpdateFunctionCommandOutput,
} from "@stedi/sdk-client-functions";

let _functionsClient: FunctionsClient;

export const functionClient = (): FunctionsClient => {
  if (_functionsClient === undefined) {
    const config: FunctionsClientConfig = {
      maxAttempts: 5,
      region: "us-east-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 1_000,
      }),
    };

    // additional config needed when running function code locally.
    if (!process.env.LAMBDA_TASK_ROOT) {
      config.endpoint = `https://functions.cloud.us.stedi.com/2021-11-16`;
      config.apiKey = process.env.STEDI_API_KEY ?? "";
    }
    _functionsClient = new FunctionsClient(config);
  }

  return _functionsClient;
};

export const invokeFunction = async (
  functionName: string,
  input: any
): Promise<any> => {
  const result = await functionClient().send(
    new InvokeFunctionCommand({
      functionName,
      requestPayload: new TextEncoder().encode(JSON.stringify(input)),
    })
  );

  return result.responsePayload?.toString();
};

export const createFunction = async (
  functionName: string,
  functionPackage: Uint8Array,
  environmentVariables?: {
    [key: string]: string;
  }
): Promise<CreateFunctionCommandOutput> => {
  return functionClient().send(
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
  return functionClient().send(
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
  return functionClient().send(
    new DeleteFunctionCommand({
      functionName,
    })
  );
};
