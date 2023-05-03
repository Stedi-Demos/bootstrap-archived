// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationBucketSchema = z
  .object({
    type: z.literal("bucket"),
    bucketName: z.string(),
    path: z.string(),
    baseFilename: z
      .string()
      .describe("Optional prefix added to output file")
      .optional(),
    fileExtention: z
      .string()
      .regex(new RegExp("^(?!\\.).+"))
      .describe(
        "defaults to 'edi', 'json', or 'csv', depending on output file type. Do not include a leading dot"
      )
      .optional(),
  })
  .strict();

export type DestinationBucket = z.infer<typeof DestinationBucketSchema>;
