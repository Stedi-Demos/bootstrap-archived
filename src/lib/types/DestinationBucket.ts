// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationBucketSchema = z
  .object({
    type: z.literal("bucket"),
    bucketName: z.string(),
    path: z.string(),
    baseFilename: z.string().optional(),
  })
  .strict();

export type DestinationBucket = z.infer<typeof DestinationBucketSchema>;
