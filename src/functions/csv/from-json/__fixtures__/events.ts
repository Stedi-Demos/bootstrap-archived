import { CoreFileProcessed } from "../../../../lib/types/FileProcessed.js";

export const inputBucketName = "test-input-bucket";
export const inputBaseFilename = "test";
const inputFileExtension = "json";
const inputKey = `${inputBaseFilename}.${inputFileExtension}`;

export const sampleFileProcessedEvent: CoreFileProcessed = {
  version: "0",
  id: "some-event-id",
  "detail-type": "file.processed",
  source: "stedi.core",
  account: "account-id",
  time: "2023-04-25T22:22:22.222Z",
  region: "us-east-1",
  detail: {
    version: "2023-02-13",
    metadata: {
      processedAt: "2023-04-25T22:22:22.444Z",
    },
    source: {
      type: "JSON",
      bucketName: inputBucketName,
      key: inputKey,
    },
  },
};
