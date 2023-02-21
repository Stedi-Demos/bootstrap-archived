import { PutObjectCommand, PutObjectCommandInput } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../buckets.js";
import { DeliveryFnForDestinationTypeInput } from "../deliveryManager.js";

export const deliverToDestination = async (
  input: DeliveryFnForDestinationTypeInput
): Promise<PutObjectCommandInput> => {
  if(input.destination.type !== "bucket") {
    throw new Error("invalid destination type (must be bucket)");
  }

  const key = input.destinationFilename
    ? `${input.destination.path}/${input.destinationFilename}`
    : input.destination.path;
  const putCommandArgs: PutObjectCommandInput = {
    bucketName: input.destination.bucketName,
    key,
    body: input.body,
  };

  await bucketClient().send(new PutObjectCommand(putCommandArgs));
  return putCommandArgs;
};