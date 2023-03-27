import { ErrorWithContext } from "../../../lib/errorWithContext.js";

export interface FilteredKey {
  key: string;
  reason: string;
}

export interface KeyToProcess {
  bucketName: string;
  key: string;
}

export interface GroupedEventKeys {
  filteredKeys: FilteredKey[];
  keysToProcess: KeyToProcess[];
}

interface ProcessingError {
  key: string;
  error: ErrorWithContext;
}

export interface ProcessingResults {
  filteredKeys: FilteredKey[];
  processingErrors: ProcessingError[];
  processedKeys: string[];
}
