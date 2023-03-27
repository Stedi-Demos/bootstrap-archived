import { DeliverToDestinationInput } from "../deliveryManager.js";
import { invokeFunction } from "../functions.js";
import { DestinationFunction } from "../types/Destination.js";

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<string | undefined> => {
  if (input.destination.type !== "function") {
    throw new Error("invalid destination type (must be function)");
  }

  const functionInput = buildFunctionInput(
    input.destinationPayload,
    input.destination.additionalInput
  );
  return await invokeFunction(input.destination.functionName, functionInput);
};

const buildFunctionInput = (
  destinationPayload: DeliverToDestinationInput["destinationPayload"],
  additionalInput?: DestinationFunction["additionalInput"]
): string | unknown => {
  if (additionalInput && typeof destinationPayload === "string") {
    throw new Error(
      "additionalInput for function destination not supported with string payload"
    );
  }

  return typeof destinationPayload === "object"
    ? { ...destinationPayload, ...additionalInput }
    : destinationPayload;
};
