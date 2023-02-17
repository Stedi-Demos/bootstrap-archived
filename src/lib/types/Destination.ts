import z from "zod";

const DestinationWebhookSchema = z.strictObject({
  type: z.literal("webhook"),
  url: z.string(),
  verb: z.enum([
    "PATCH",
    "POST",
    "PUT",
  ]).default("POST"),
  headers: z.record(
    // `Content-Type` header override is not allowed
    z.string().regex(/^(?!content-type).+$/i),
    z.string()
  ).optional(),
});
export const DestinationBucketSchema = z.strictObject({
  type: z.literal("bucket"),
  bucketName: z.string(),
  path: z.string(),
});

export type DestinationBucket = z.infer<typeof DestinationBucketSchema>;

export const DestinationSchema = z.strictObject({
  mappingId: z.string().optional(),
  destination: z.discriminatedUnion("type", [
    DestinationWebhookSchema,
    DestinationBucketSchema,
  ]),
});

export type Destination = z.infer<typeof DestinationSchema>;