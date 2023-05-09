import { GetValueCommand, SetValueCommand } from "@stedi/sdk-client-stash";

import { PARTNERS_KEYSPACE_NAME } from "../../../lib/constants.js";
import {
  failedExecution,
  FailureResponse,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  RemotePollerConfig,
  RemotePollerConfigMap,
  RemotePollerConfigMapSchema,
} from "../../../lib/types/RemoteConnectionConfig.js";
import { RemotePollingResults } from "./types.js";
import { RemotePoller } from "./pollers/remotePoller.js";
import { FtpPoller } from "./pollers/ftpPoller.js";
import { SftpPoller } from "./pollers/sftpPoller.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { stashClient } from "../../../lib/clients/stash.js";

const keyspaceName = PARTNERS_KEYSPACE_NAME;
const ftpConfigStashKey = "bootstrap|remote-poller-config";

const getRemotePoller = async (
  remotePollerConfig: RemotePollerConfig
): Promise<RemotePoller> => {
  switch (remotePollerConfig.connectionDetails.protocol) {
    case "ftp":
      return await FtpPoller.getPoller(remotePollerConfig.connectionDetails);
    case "sftp":
      return await SftpPoller.getPoller(remotePollerConfig.connectionDetails);
  }
};

export const handler = async (
  configId: string
): Promise<RemotePollingResults | FailureResponse> => {
  const executionTime = new Date().toISOString();
  const executionId = generateExecutionId({ executionTime });

  await recordNewExecution(executionId, { executionTime });
  console.log("starting", {
    executionId,
    payload: JSON.stringify({ executionTime }),
  });

  try {
    const stashResponse = await stashClient().send(
      new GetValueCommand({
        keyspaceName,
        key: ftpConfigStashKey,
      })
    );

    // `FtpPollerConfigMap.parse` handles failed stash lookup as well (value is undefined)
    const remotePollerConfigMap: RemotePollerConfigMap =
      RemotePollerConfigMapSchema.parse(stashResponse.value);
    const pollerConfig: RemotePollerConfig | undefined =
      remotePollerConfigMap[configId];

    if (!pollerConfig) {
      return failedExecution(
        executionId,
        new ErrorWithContext("config not found for key", { configId })
      );
    }

    console.log(`polling ${pollerConfig.connectionDetails.protocol}`, {
      executionId,
      payload: JSON.stringify({
        configKey: configId,
        hostname: pollerConfig.connectionDetails.config.host,
        remotePath: pollerConfig.remotePath,
      }),
    });

    const results = await pollRemoteServer(pollerConfig);

    if (results.processingErrors.length > 0) {
      return failedExecution(
        executionId,
        new ErrorWithContext(
          "at least one processing error encountered during polling",
          { results }
        )
      );
    }

    // update `lastPollTime` for this ftp config
    pollerConfig.lastPollTime = results.lastPollTime;
    const value = {
      ...(remotePollerConfigMap as object),
      [configId]: { ...(pollerConfig as object) },
    };

    await stashClient().send(
      new SetValueCommand({
        keyspaceName,
        key: ftpConfigStashKey,
        value,
      })
    );

    await markExecutionAsSuccessful(executionId);
    return results;
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);
    return failedExecution(executionId, error);
  }
};

const pollRemoteServer = async (
  remotePollerConfig: RemotePollerConfig
): Promise<RemotePollingResults> => {
  const remotePoller = await getRemotePoller(remotePollerConfig);
  // initialize poll time to moment before retrieving file details
  const currentInvocationPollTime = new Date();
  const fileDetails = await remotePoller.getRemoteFileDetails(
    remotePollerConfig.remotePath,
    remotePollerConfig.remoteFiles
  );

  const ftpPollingResults: RemotePollingResults = {
    lastPollTime: currentInvocationPollTime,
    processedFiles: [],
    skippedItems: fileDetails.skippedItems ?? [],
    processingErrors: fileDetails.processingErrors ?? [],
  };

  for await (const file of fileDetails.filesToProcess) {
    // if last poll time is not set, use `0` (epoch)
    // if remote file modifiedAt is not set, use current time
    const lastPollTimestamp = remotePollerConfig.lastPollTime?.getTime() ?? 0;
    const remoteFileTimestamp = file.lastModifiedTime;
    if (remoteFileTimestamp < lastPollTimestamp) {
      ftpPollingResults.skippedItems.push({
        path: file.path,
        name: file.name,
        reason: `remote timestamp (${remoteFileTimestamp}) is not newer than last poll timestamp (${lastPollTimestamp})`,
      });
      continue;
    }

    // if timestamp of file being processed is after the currently tracked time for this invocation,
    // update the currently tracked time to match (file presumably arrived during processing)
    if (remoteFileTimestamp > ftpPollingResults.lastPollTime.getTime()) {
      ftpPollingResults.lastPollTime = new Date(remoteFileTimestamp);
    }

    try {
      await remotePoller.downloadFile(remotePollerConfig.destination, file);
      remotePollerConfig.deleteAfterProcessing &&
        (await remotePoller.deleteFile(file));
      ftpPollingResults.processedFiles.push(file);
    } catch (e) {
      const error = ErrorWithContext.fromUnknown(e);
      ftpPollingResults.processingErrors.push({
        path: `${file.path}/${file.name}`,
        error,
      });
    }
  }

  await remotePoller.disconnect();
  return ftpPollingResults;
};
