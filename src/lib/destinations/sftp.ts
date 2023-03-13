import sftp from "ssh2-sftp-client";

import {
  DeliverToDestinationInput,
  payloadAsString,
} from "../deliveryManager.js";

type SftpDeliveryResult = {
  host: string;
  username: string;
  remotePath: string;
  contents: any;
};

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<SftpDeliveryResult> => {
  if (input.destination.type !== "sftp") {
    throw new Error("invalid destination type (must be sftp)");
  }

  const remotePath = `${input.destination.remotePath}/${input.destinationFilename}`;
  const { host, username } = input.destination.connectionDetails;
  const fileContents = payloadAsString(input.destinationPayload);

  const config = input.destination.connectionDetails;
  const options: sftp.ConnectOptions = {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 10_000,
    algorithms: {
      serverHostKey: ['ssh-rsa'],
      cipher: ['aes128-ctr'],
      kex: ['diffie-hellman-group14-sha1']
    },
  };
  const sftpClient = new sftp();
  await sftpClient.connect(options);
  await sftpClient.put(Buffer.from(fileContents), remotePath);
  await sftpClient.end();

  return {
    host,
    username,
    remotePath,
    contents: fileContents,
  };
};
