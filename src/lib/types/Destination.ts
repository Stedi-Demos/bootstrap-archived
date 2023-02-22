import z from "zod";

import { SftpConfigSchema } from "./RemoteConnectionConfig.js";

const WebhookVerbSchema = z.enum([
  "PATCH",
  "POST",
  "PUT",
]);

export type WebhookVerb = z.infer<typeof WebhookVerbSchema>;

const DestinationWebhookSchema = z.strictObject({
  type: z.literal("webhook"),
  url: z.string(),
  verb: WebhookVerbSchema.default("POST"),
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

export const DestinationSftpSchema = z.strictObject({
  type: z.literal("sftp"),
  connectionDetails: SftpConfigSchema,
  remotePath: z.string().default("/"),
});

const DestinationFunctionSchema = z.strictObject({
  type: z.literal("function"),
  functionName: z.string(),
  additionalInput: z.any().optional(),
});

export const DestinationSchema = z.strictObject({
  mappingId: z.string().optional(),
  destination: z.discriminatedUnion("type", [
    DestinationBucketSchema,
    DestinationFunctionSchema,
    DestinationSftpSchema,
    DestinationWebhookSchema,
  ]),
});

export type Destination = z.infer<typeof DestinationSchema>;