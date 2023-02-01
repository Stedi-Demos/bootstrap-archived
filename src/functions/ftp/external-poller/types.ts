import * as ftp from "basic-ftp";

export type SkippedItem = {
  path: string;
  reason: string;
};

export type RemoteFileDetails = {
  filesToProcess: ftp.FileInfo[];
  processingErrors?: ProcessingError[];
  skippedItems?: SkippedItem[];
};

export type ProcessingError = {
  path: string;
  errorMessage: string;
};

export type FtpPollingResults = {
  processedFiles: string[];
  skippedItems: SkippedItem[];
  processingErrors: ProcessingError[];
};
