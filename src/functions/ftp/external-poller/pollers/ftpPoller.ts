import path from "path";
import * as ftp from "basic-ftp";
import fs from "node:fs";
import { Client } from "basic-ftp";

import { PutObjectCommand } from "@stedi/sdk-client-buckets";

import { bucketsClient } from "../../../../lib/clients/buckets.js";
import { FileDetails, ProcessingError, RemoteFileDetails } from "../types.js";
import { DestinationBucket } from "../../../../lib/types/Destination.js";
import { ConnectionDetails } from "../../../../lib/types/RemoteConnectionConfig.js";
import { RemotePoller } from "./remotePoller.js";
import { ErrorWithContext } from "../../../../lib/errorWithContext.js";

const buckets = bucketsClient();

export class FtpPoller extends RemotePoller {
  readonly client: Client;

  private constructor() {
    super();
    this.client = new ftp.Client();
  }

  async connect(connectionDetails: ConnectionDetails): Promise<void> {
    await this.client.access(connectionDetails.config);
  }

  async disconnect(): Promise<void> {
    this.client.close();
  }

  async getRemoteFileDetails(
    remotePath = "/",
    remoteFiles?: string[]
  ): Promise<RemoteFileDetails> {
    const normalizedRemotePath = path.normalize(remotePath);
    return remoteFiles && remoteFiles.length > 0
      ? await this.getSpecifiedFileDetails(normalizedRemotePath, remoteFiles)
      : await this.getAllFileDetailsForPath(normalizedRemotePath);
  }

  async downloadFile(
    destination: DestinationBucket,
    file: FileDetails
  ): Promise<void> {
    const localTmpFilePath = `/tmp/${file.name}`;
    await this.client.downloadTo(localTmpFilePath, this.getFullFilePath(file));

    const destinationKey = `${destination.path}/${file.name}`;
    await buckets.send(
      new PutObjectCommand({
        bucketName: destination.bucketName,
        key: destinationKey,
        body: fs.createReadStream(localTmpFilePath),
      })
    );

    // clean up temporary local file
    fs.rmSync(localTmpFilePath);
  }

  async deleteFile(file: FileDetails): Promise<void> {
    await this.client.remove(this.getFullFilePath(file));
  }

  private async getSpecifiedFileDetails(
    remotePath: string,
    remoteFiles: string[]
  ): Promise<RemoteFileDetails> {
    const filesToProcess: FileDetails[] = [];
    const processingErrors: ProcessingError[] = [];

    for await (const file of remoteFiles) {
      const remoteFilePath = `${remotePath}/${file}`;
      const listResult = await this.client.list(remoteFilePath);
      if (listResult.length !== 1) {
        processingErrors.push({
          path: remoteFilePath,
          error: new ErrorWithContext(
            `Expected exactly one match for list of single file`,
            { remoteFilePath }
          ),
        });
        break;
      }

      listResult[0].isFile
        ? filesToProcess.push({
            path: remotePath,
            ...this.extractFileDetails(listResult[0]),
          })
        : // handle non-file as processing error since file was specifically requested
          processingErrors.push({
            path: remoteFilePath,
            error: new ErrorWithContext(
              `Requested remote file, but it is not a file`,
              { file }
            ),
          });
    }

    return {
      filesToProcess,
      processingErrors,
    };
  }

  private async getAllFileDetailsForPath(
    remotePath: string
  ): Promise<RemoteFileDetails> {
    const directoryContents = await this.client.list(remotePath);
    return directoryContents.reduce(
      (remoteFileDetails: RemoteFileDetails, currentFile) => {
        currentFile.isFile
          ? remoteFileDetails.filesToProcess.push({
              path: remotePath,
              ...this.extractFileDetails(currentFile),
            })
          : remoteFileDetails.skippedItems?.push({
              path: remotePath,
              name: currentFile.name,
              reason: "not a file",
            });

        return remoteFileDetails;
      },
      { filesToProcess: [], skippedItems: [] }
    );
  }

  private extractFileDetails(file: ftp.FileInfo): Omit<FileDetails, "path"> {
    return {
      name: file.name,
      lastModifiedTime: file.modifiedAt?.getTime() || 0,
    };
  }

  static getPoller = async (
    connectionDetails: ConnectionDetails
  ): Promise<RemotePoller> => {
    const poller = new FtpPoller();
    await poller.connect(connectionDetails);
    return poller;
  };
}
