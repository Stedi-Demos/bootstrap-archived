import {
  StartFileTransferCommand,
  StartFileTransferCommandInput,
} from "@stedi/sdk-client-as2";
import {
  PutObjectCommand,
  PutObjectCommandInput,
} from "@stedi/sdk-client-buckets";
import { as2Client } from "../clients/as2.js";
import { bucketsClient } from "../clients/buckets.js";

import {
  DeliverToDestinationInput,
  payloadAsString,
} from "../deliveryManager.js";

const as2 = as2Client();
const buckets = bucketsClient();

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<StartFileTransferCommandInput> => {
  if (input.destination.type !== "as2") {
    throw new Error("invalid destination type (must be as2)");
  }

  const key = `${input.destination.path}/${input.destinationFilename}`;
  const putCommandArgs: PutObjectCommandInput = {
    bucketName: input.destination.bucketName,
    key,
    body: payloadAsString(input.destinationPayload),
  };

  const startFileTransferCommandArgs: StartFileTransferCommandInput = {
    connectorId: input.destination.connectorId,
    sendFilePaths: [`/${input.destination.bucketName}/${key}`],
  };

  await buckets.send(new PutObjectCommand(putCommandArgs));
  await as2.send(new StartFileTransferCommand(startFileTransferCommandArgs));

  return startFileTransferCommandArgs;
};
