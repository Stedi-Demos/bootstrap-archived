import { SftpClient, SftpClientConfig } from "@stedi/sdk-client-sftp";
import { DEFAULT_SDK_CLIENT_PROPS } from "../constants.js";
import { StandardRetryStrategy } from "@aws-sdk/middleware-retry";

let _sftpClient: SftpClient | undefined;

export const sftpClient = () => {
  if (_sftpClient === undefined) {
    const standardRetryStrategy = new StandardRetryStrategy(
      () => Promise.resolve(DEFAULT_SDK_CLIENT_PROPS.maxAttempts),
      {
        delayDecider: (_delayBase, _attempts) => {
          return 10_000;
        },
      }
    );

    const config: SftpClientConfig = {
      ...DEFAULT_SDK_CLIENT_PROPS,
      retryStrategy: standardRetryStrategy,
    };

    if (process.env.USE_PREVIEW !== undefined) config.stage = "preproduction";

    _sftpClient = new SftpClient(config);
  }

  return _sftpClient;
};
