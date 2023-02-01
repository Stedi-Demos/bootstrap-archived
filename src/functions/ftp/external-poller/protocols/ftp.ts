import * as ftp from "basic-ftp";
import fs from "node:fs";
import path from "path";
import { serializeError } from "serialize-error";

import { PutObjectCommand } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../../../../lib/buckets.js";
import { requiredEnvVar } from "../../../../lib/environment.js";
import { FtpPollerConfig } from "../../../../lib/types/FtpPollerConfig.js";
import {
  FtpPollingResults,
  ProcessingError,
  RemoteFileDetails,
  SkippedItem,
} from "../types";

const destinationBucketName = requiredEnvVar("SFTP_BUCKET_NAME");
const client = new ftp.Client();

export const pollFtp = async (
  ftpConfig: FtpPollerConfig
): Promise<FtpPollingResults> => {
  await client.access(ftpConfig.connectionDetails.config);

  const fileDetails =
    ftpConfig.remoteFiles && ftpConfig.remoteFiles.length > 0
      ? await getSpecifiedFileDetails(
          ftpConfig.remotePath,
          ftpConfig.remoteFiles
        )
      : await getAllFileDetailsForPath(ftpConfig.remotePath);

  const ftpPollingResults: FtpPollingResults = {
    processedFiles: [],
    skippedItems: fileDetails.skippedItems || [],
    processingErrors: fileDetails.processingErrors || [],
  };

  for await (const file of fileDetails.filesToProcess) {
    const remoteFilePath = path.normalize(
      `${ftpConfig.remotePath}/${file.name}`
    );

    // if last poll time is not set, use `0` (epoch)
    // if remote file modifiedAt is not set, use current time
    const lastPollTimestamp = ftpConfig.lastPollTime?.getTime() || 0;
    const remoteFileTimestamp = file.modifiedAt?.getTime() || Date.now();
    if (remoteFileTimestamp < lastPollTimestamp) {
      ftpPollingResults.skippedItems.push(<SkippedItem>{
        path: remoteFilePath,
        reason: `remote timestamp (${remoteFileTimestamp}) is not newer than last poll timestamp (${lastPollTimestamp})`,
      });
      break;
    }

    try {
      // downloading to `/tmp is a workaround until BucketsClient supports multipart uploads (required for stream upload)
      const localTmpFilePath = `/tmp/${file.name}`;
      await client.downloadTo(localTmpFilePath, remoteFilePath);

      const destinationKey = `${ftpConfig.destinationPath}/${file.name}`;
      await bucketClient().send(
        new PutObjectCommand({
          bucketName: destinationBucketName,
          key: destinationKey,
          body: fs.createReadStream(localTmpFilePath),
        })
      );

      // clean up temporary local file, and optionally remote file on ftp server
      fs.rmSync(localTmpFilePath);
      ftpConfig.deleteAfterProcessing && (await client.remove(remoteFilePath));

      ftpPollingResults.processedFiles.push(remoteFilePath);
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : serializeError(e).message ?? "_unknown_";

      ftpPollingResults.processingErrors.push({
        path: remoteFilePath,
        errorMessage,
      });
    }
  }

  client.close();
  return ftpPollingResults;
};

const getSpecifiedFileDetails = async (
  remotePath: string,
  remoteFiles: string[]
): Promise<RemoteFileDetails> => {
  const filesToProcess: ftp.FileInfo[] = [];
  const processingErrors: ProcessingError[] = [];

  for await (const file of remoteFiles) {
    const remoteFilePath = `${remotePath}/${file}`;
    const listResult = await client.list(remoteFilePath);
    if (listResult.length !== 1) {
      processingErrors.push({
        path: remoteFilePath,
        errorMessage: `expected exactly one match for list of single file ${remoteFilePath}`,
      });
      break;
    }

    listResult[0].isFile
      ? filesToProcess.push(listResult[0])
      : // handle non-file as processing error since file was specifically requested
        processingErrors.push({
          path: remoteFilePath,
          errorMessage: `requested remote file ${file}, but it is not a file`,
        });
  }

  return {
    filesToProcess,
    processingErrors,
  };
};

const getAllFileDetailsForPath = async (
  remotePath: string
): Promise<RemoteFileDetails> => {
  const directoryContents = await client.list(remotePath);
  return directoryContents.reduce(
    (remoteFileDetails: RemoteFileDetails, currentFile) => {
      currentFile.isFile
        ? remoteFileDetails.filesToProcess.push(currentFile)
        : remoteFileDetails.skippedItems?.push({
            path: `${remotePath}/${currentFile.name}`,
            reason: "not a file",
          });

      return remoteFileDetails;
    },
    { filesToProcess: [], skippedItems: [] }
  );
};
