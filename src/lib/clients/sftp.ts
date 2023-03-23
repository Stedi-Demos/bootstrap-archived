import { SftpClient, SftpClientConfig } from "@stedi/sdk-client-sftp";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";

let _sftpClient: SftpClient | undefined;

export const sftpClient = () => {
  if (_sftpClient === undefined) {
    const config: SftpClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _sftpClient = new SftpClient(config);
  }

  return _sftpClient;
};
