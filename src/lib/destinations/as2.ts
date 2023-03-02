import { As2Client, StartFileTransferCommand, StartFileTransferCommandInput } from "@stedi/sdk-client-as2";
import { PutObjectCommand, PutObjectCommandInput } from "@stedi/sdk-client-buckets";

import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";
import { bucketClient } from "../buckets.js";
import { DeliverToDestinationInput, payloadAsString } from "../deliveryManager.js";

const as2Client = new As2Client(DEFAULT_SDK_CLIENT_PROPS);
export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<StartFileTransferCommandInput> => {
  if (input.destination.type !== "as2") {
    throw new Error("invalid destination type (must be as2)");
  }

  const key = input.destinationFilename
    ? `${input.destination.path}/${input.destinationFilename}`
    : input.destination.path;

  const putCommandArgs: PutObjectCommandInput = {
    bucketName: input.destination.bucketName,
    key,
    body: payloadAsString(input.destinationPayload),
  };


  const startFileTransferCommandArgs: StartFileTransferCommandInput = {
    connectorId: input.destination.connectorId,
    sendFilePaths: [`/${input.destination.bucketName}/${key}`],
  }

  await bucketClient().send(new PutObjectCommand(putCommandArgs));
  await as2Client.send(new StartFileTransferCommand(startFileTransferCommandArgs));

  return startFileTransferCommandArgs;
};