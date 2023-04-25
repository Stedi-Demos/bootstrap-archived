import * as z from "zod";

export const CoreFileProcessedSchema = z.object({
  version: z.string(),
  id: z.string(),
  "detail-type": z.literal("file.processed"),
  account: z.string(),
  region: z.string(),
  source: z.literal("stedi.core"),
  time: z.string().datetime(),
  detail: z.object({
    version: z.string(),
    metadata: z.object({
      processedAt: z.string().datetime(),
    }),
    source: z.object({
      type: z.enum(["CSV", "JSON"]),
      bucketName: z.string(),
      key: z.string(),
      size: z.number().optional(),
    }),
  }),
});

export type CoreFileProcessed = z.infer<typeof CoreFileProcessedSchema>;
