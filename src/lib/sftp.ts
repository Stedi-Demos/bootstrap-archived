import { SftpClient } from "@stedi/sdk-client-sftp";

let _sftpClient: SftpClient;

export const sftpClient = () => {
  if (_sftpClient === undefined) {
    _sftpClient = new SftpClient({
      region: "us-east-1",
      endpoint: "https://api.sftp.us.stedi.com/2022-04-01",
      apiKey: process.env.STEDI_API_KEY,
    });
  }

  return _sftpClient;
};
