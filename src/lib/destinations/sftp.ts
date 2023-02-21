import sftp from "ssh2-sftp-client";

import { DeliveryFnForDestinationTypeInput } from "../deliveryManager.js";

type SftpDeliveryResult = {
  host: string;
  username: string;
  remotePath: string;
  contents: any;
};

export const deliverToDestination = async (
  input: DeliveryFnForDestinationTypeInput
): Promise<SftpDeliveryResult> => {
  if(input.destination.type !== "sftp") {
    throw new Error("invalid destination type (must be sftp)");
  }

  const filename = input.destinationFilename || `payload-${Date.now()}.out`;
  const remotePath = `${input.destination.remotePath}/${filename}`;
  const { host, username } = input.destination.connectionDetails;

  const sftpClient = new sftp();
  await sftpClient.connect(input.destination.connectionDetails);
  await sftpClient.put(Buffer.from(input.body), remotePath);
  await sftpClient.end();

  return {
    host,
    username,
    remotePath,
    contents: input.body,
  };
};
