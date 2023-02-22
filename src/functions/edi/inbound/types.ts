import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export type FilteredKey = {
  key: string;
  reason: string;
};

export type KeyToProcess = {
  bucketName: string;
  key: string;
};

export type GroupedEventKeys = {
  filteredKeys: FilteredKey[];
  keysToProcess: KeyToProcess[];
};

type ProcessingError = {
  key: string;
  error: ErrorWithContext;
};

export type ProcessingResults = {
  filteredKeys: FilteredKey[];
  processingErrors: ProcessingError[];
  processedKeys: string[];
};