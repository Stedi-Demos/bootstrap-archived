import z from "zod";

export const SftpConfigSchema = z.strictObject({
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  password: z.string(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
});

const WebhookVerbSchema = z.enum(["PATCH", "POST", "PUT"]).optional();

export type WebhookVerb = z.infer<typeof WebhookVerbSchema>;

const DestinationWebhookSchema = z.strictObject({
  type: z.literal("webhook"),
  url: z.string(),
  verb: WebhookVerbSchema.default("POST"),
  headers: z
    .record(
      // `Content-Type` header override is not allowed
      z.string().regex(/^(?!content-type).+$/i),
      z.string()
    )
    .optional(),
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
  additionalInput: z.record(z.string(), z.unknown()).optional(),
});

export type DestinationFunction = z.infer<typeof DestinationFunctionSchema>;

const DestinationAs2Schema = DestinationBucketSchema.extend({
  type: z.literal("as2"),
  connectorId: z.string(),
});

const DestinationStashSchema = z.strictObject({
  type: z.literal("stash"),
  keyspaceName: z.string(),
  keyPrefix: z.string().optional(),
});

export const DestinationSchema = z.strictObject({
  mappingId: z.string().optional(),
  usageIndicatorCode: z
    .enum(["P", "T", "I"])
    .optional()
    .describe(
      "configure destination to receive the transaction set only when the envelope usage indicator code matches the supplied value"
    ),
  release: z
    .string()
    .min(6)
    .max(12)
    .optional()
    .describe(
      "configure destination to receive the transaction set only when the envelope release matches the supplied value"
    ),
  destination: z.discriminatedUnion("type", [
    DestinationAs2Schema,
    DestinationBucketSchema,
    DestinationFunctionSchema,
    DestinationSftpSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
  ]),
});

export type Destination = z.input<typeof DestinationSchema>;

export const TransactionSetDestinationsSchema = z.strictObject({
  description: z.string().optional(),
  destinations: z.array(DestinationSchema),
});

export type TransactionSetDestinations = z.input<
  typeof TransactionSetDestinationsSchema
>;

export const destinationAckKey = (partnershipId: string) =>
  `functional_acknowledgments|${partnershipId}`;

export const DestinationAckSchema = z.strictObject({
  generateFor: z.array(z.string().describe("Transaction Set ID")),
});

export type DestinationAck = z.infer<typeof DestinationAckSchema>;

export const destinationExecutionErrorKey = "destinations|errors|execution";

export const destinationFileErrorEventsKey = "destinations|errors|file_error";

const DestinationErrorSchema = z.strictObject({
  description: z.string().optional(),
  mappingId: z.string().optional(),
  destination: z.discriminatedUnion("type", [
    DestinationFunctionSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
    DestinationBucketSchema,
  ]),
});

export const DestinationErrorEventsSchema = z.strictObject({
  description: z.string().optional(),
  destinations: z.array(DestinationErrorSchema),
});

export type DestinationErrorEvents = z.infer<
  typeof DestinationErrorEventsSchema
>;
