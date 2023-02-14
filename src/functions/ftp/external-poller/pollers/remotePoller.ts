import { FileDetails, RemoteFileDetails } from "../types.js";
import { DestinationBucket } from "../../../../lib/types/PartnerRouting.js";
import { ConnectionDetails } from "../../../../lib/types/RemotePollerConfig.js";

export abstract class RemotePoller {
  abstract getRemoteFileDetails(remotePath: string, remoteFiles?: string[]): Promise<RemoteFileDetails>;

  abstract downloadFile(destination: DestinationBucket, file: FileDetails): Promise<void>;

  abstract deleteFile(file: FileDetails): Promise<void>;

  abstract disconnect(): Promise<void>;

  protected getFullFilePath = (file: FileDetails): string => `${file.path}/${file.name}`;

  static getPoller: (connectionDetails: ConnectionDetails) => Promise<RemotePoller>;
}