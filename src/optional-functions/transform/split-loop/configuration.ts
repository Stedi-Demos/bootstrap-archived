import { Configuration } from "./types";

const coreIngestionBucket = process.env.CORE_INGESTION_BUCKET_NAME!;

export default {
  configuration: {
    target: {
      bucketName: coreIngestionBucket,
      keyPrefix: "split-loop/" as string,
    },
    splitSegment: { start: "LX", end: ["L3"] },
    chunkSize: 1_000,
    transactionSetId: "210",
  } satisfies Configuration,
};
