export interface Configuration {
  target: {
    bucketName: string;
    keyPrefix: string;
  };
  splitSegment: { start: string; end: string[] };
  chunkSize?: number; // default 1_000
  transactionSetId: string;
}

export interface FileFailedDetail {
  version: "2023-02-13";
  fileId: string;
  direction: "SENT" | "RECEIVED" | "UNKNOWN";
  envelopes?: unknown;
  input: {
    type: "EDI/X12" | "STEDI/GUIDE-JSON";
    bucketName: string;
    key: string;
  };
  errors: unknown[];
}
