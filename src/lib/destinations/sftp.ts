import sftp from "ssh2-sftp-client";

import {
  DeliverToDestinationInput,
  generateDestinationFilename,
  payloadAsString,
} from "../deliveryManager.js";

interface SftpDeliveryResult {
  host: string;
  username: string;
  remotePath: string;
  contents: unknown;
}

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<SftpDeliveryResult> => {
  if (input.destination.type !== "sftp") {
    throw new Error("invalid destination type (must be sftp)");
  }

  const destinationFilename = generateDestinationFilename(
    input.payloadMetadata,
    input.destination.baseFilename
  );
  const remotePath = `${input.destination.remotePath ?? ""}${
    input.destination.remotePath?.endsWith("/") ? "" : "/"
  }${destinationFilename}`;
  const { host, username } = input.destination.connectionDetails;
  const fileContents = payloadAsString(input.destinationPayload);

  const sftpClient = new sftp();
  await sftpClient.connect(input.destination.connectionDetails);
  await sftpClient.put(Buffer.from(fileContents), remotePath);
  await sftpClient.end();

  return {
    host,
    username,
    remotePath,
    contents: fileContents,
  };
};
