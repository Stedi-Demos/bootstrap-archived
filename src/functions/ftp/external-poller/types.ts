import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export type SkippedItem = {
  path: string;
  name: string;
  reason: string;
};

export type FileDetails = {
  path: string;
  name: string;
  lastModifiedTime: number;
};

export type RemoteFileDetails = {
  filesToProcess: FileDetails[];
  processingErrors?: ProcessingError[];
  skippedItems?: SkippedItem[];
};

export type ProcessingError = {
  path: string;
  error: ErrorWithContext;
};

export type RemotePollingResults = {
  processedFiles: FileDetails[];
  skippedItems: SkippedItem[];
  processingErrors: ProcessingError[];
};

