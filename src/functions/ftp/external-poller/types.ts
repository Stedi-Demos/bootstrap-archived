import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export interface SkippedItem {
  path: string;
  name: string;
  reason: string;
}

export interface FileDetails {
  path: string;
  name: string;
  lastModifiedTime: number;
}

export interface RemoteFileDetails {
  filesToProcess: FileDetails[];
  processingErrors?: ProcessingError[];
  skippedItems?: SkippedItem[];
}

export interface ProcessingError {
  path: string;
  error: ErrorWithContext;
}

export interface RemotePollingResults {
  processedFiles: FileDetails[];
  skippedItems: SkippedItem[];
  processingErrors: ProcessingError[];
}
