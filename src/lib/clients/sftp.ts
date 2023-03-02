import { SftpClient, SftpClientConfig } from "@stedi/sdk-client-sftp";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _sftpClient: SftpClient;

export const sftpClient = () => {
  if (_sftpClient === undefined) {
    const config: SftpClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env["USE_PREVIEW"] !== undefined)
      config.endpoint =
        "https://api.sftp.us.preproduction.stedi.com/2022-04-01";

    _sftpClient = new SftpClient(config);
  }

  return _sftpClient;
};
