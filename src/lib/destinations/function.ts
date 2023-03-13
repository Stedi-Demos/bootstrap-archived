import { DeliverToDestinationInput } from "../deliveryManager.js";
import { invokeFunction } from "../functions.js";

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<string | undefined> => {
  if(input.destination.type !== "function") {
    throw new Error("invalid destination type (must be function)");
  }

  return await invokeFunction(input.destination.functionName, {
    additionalInput: input.destination.additionalInput,
    payload: input.destinationPayload,
  });
};