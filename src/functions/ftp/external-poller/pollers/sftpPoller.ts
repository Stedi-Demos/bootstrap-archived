import path from "path";
import sftp from "ssh2-sftp-client";

import { PutObjectCommand } from "@stedi/sdk-client-buckets";

import { FileDetails, ProcessingError, RemoteFileDetails } from "../types.js";
import { DestinationBucket } from "../../../../lib/types/Destination.js";
import { ConnectionDetails } from "../../../../lib/types/RemoteConnectionConfig.js";
import { RemotePoller } from "./remotePoller.js";
import { ErrorWithContext } from "../../../../lib/errorWithContext.js";
import { bucketsClient } from "../../../../lib/clients/buckets.js";

const buckets = bucketsClient();
export class SftpPoller extends RemotePoller {
  readonly client: sftp;

  private constructor() {
    super();
    this.client = new sftp();
  }

  async connect(connectionDetails: any): Promise<void> {
    const options: sftp.ConnectOptions = {
      retries: 3,
      host: connectionDetails.config.host,
      port: connectionDetails.config.port,
      username: connectionDetails.config.username,
      password: connectionDetails.config.password,
      readyTimeout: 15_000,
      timeout: 60_000,
      debug: console.log,
      algorithms: {
        serverHostKey: ["ssh-rsa", "rsa-sha2-256"],
        kex: [
          "diffie-hellman-group-exchange-sha256",
          "diffie-hellman-group14-sha256",
        ],
        cipher: ["aes256-ctr", "aes256-gcm", "aes128-ctr"],
        hmac: [
          "hmac-sha2-256-etm@openssh.com",
          "hmac-sha2-256",
          "hmac-sha2-256-96",
        ],
      },
    };

    await this.client.connect(options);
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async downloadFile(
    destination: DestinationBucket,
    file: FileDetails
  ): Promise<void> {
    const fileContents = await this.client.get(this.getFullFilePath(file));

    const destinationKey = `${destination.path}/${file.name}`;
    await buckets.send(
      new PutObjectCommand({
        bucketName: destination.bucketName,
        key: destinationKey,
        body: fileContents,
      })
    );
  }

  async deleteFile(file: FileDetails): Promise<void> {
    await this.client.delete(this.getFullFilePath(file));
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

  private async getSpecifiedFileDetails(
    remotePath: string,
    remoteFiles: string[]
  ): Promise<RemoteFileDetails> {
    const filesToProcess: FileDetails[] = [];
    const processingErrors: ProcessingError[] = [];

    for await (const file of remoteFiles) {
      const remoteFilePath = `${remotePath}/${file}`;
      const fileStats: sftp.FileStats = await this.client.stat(remoteFilePath);

      fileStats.isFile
        ? filesToProcess.push({
            path: remotePath,
            name: file,
            lastModifiedTime: fileStats.modifyTime,
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
    const directoryContents: sftp.FileInfo[] = await this.client.list(
      remotePath
    );
    return directoryContents.reduce(
      (remoteFileDetails: RemoteFileDetails, currentFile) => {
        currentFile.type === "-"
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

  private extractFileDetails(file: sftp.FileInfo): Omit<FileDetails, "path"> {
    return {
      name: file.name,
      lastModifiedTime: file.modifyTime,
    };
  }
  static getPoller = async (
    connectionDetails: ConnectionDetails
  ): Promise<RemotePoller> => {
    const poller = new SftpPoller();
    await poller.connect(connectionDetails);
    return poller;
  };
}
