import {
  PutObjectCommand,
  PutObjectCommandInput,
} from "@stedi/sdk-client-buckets";
import { bucketsClient } from "../clients/buckets.js";
import {
  DeliverToDestinationInput,
  payloadAsString,
} from "../deliveryManager.js";

const buckets = bucketsClient();

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<PutObjectCommandInput> => {
  if (input.destination.type !== "bucket") {
    throw new Error("invalid destination type (must be bucket)");
  }

  // remove any leading slashes, if present, from bucket key prefix
  const path = input.destination.path.replace(/^\/+/, "");

  const key = `${path}/${input.destinationFilename}`;
  const putCommandArgs: PutObjectCommandInput = {
    bucketName: input.destination.bucketName,
    key,
    body: payloadAsString(input.destinationPayload),
  };

  await buckets.send(new PutObjectCommand(putCommandArgs));
  return putCommandArgs;
};
