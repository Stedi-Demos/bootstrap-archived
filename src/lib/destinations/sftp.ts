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
    retries: 3,
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    readyTimeout: 20_000,
    timeout: 60_000,
    debug: console.log,
    algorithms: {
      kex: [
        //"diffie-hellman-group-exchange-sha256", // hangs
        //"diffie-hellman-group16-sha512", // hangs
        "diffie-hellman-group14-sha256",
        "diffie-hellman-group14-sha1",
      ],
      serverHostKey: ["ssh-rsa"],
      cipher: ["aes256-cbc", "aes256-ctr", "aes128-cbc", "aes128-ctr"],
      hmac: [
        "hmac-sha2-512",
        "hmac-sha2-256",
        "hmac-sha1",
      ],
    },
    tryKeyboard: true,
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
