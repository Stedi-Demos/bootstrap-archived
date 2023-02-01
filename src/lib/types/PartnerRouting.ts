import z from "zod";

export const UsageIndicatorCodeSchema = z.union([
  z.literal("P"),
  z.literal("T"),
  z.literal("I"),
]);

export type UsageIndicatorCode = z.infer<typeof UsageIndicatorCodeSchema>;

const DestinationWebhookSchema = z.strictObject({
  type: z.literal("webhook"),
  url: z.string(),
});

const DestinationBucketSchema = z.strictObject({
  type: z.literal("bucket"),
  bucketName: z.string(),
  path: z.string(),
});

const DestinationSchema = z.strictObject({
  mappingId: z.string().optional(),
  destination: z.discriminatedUnion("type", [
    DestinationWebhookSchema,
    DestinationBucketSchema,
  ]),
});

const DisabledAckSchema = z.strictObject({
  enabled: z.literal(false),
});

const EnabledAckSchema = z.strictObject({
  enabled: z.literal(true),
  destination: DestinationBucketSchema,
});

export type EnabledAck = z.infer<typeof EnabledAckSchema>;

const AckSchema = z.discriminatedUnion("enabled", [
  DisabledAckSchema,
  EnabledAckSchema,
]);

export type Destination = z.infer<typeof DestinationSchema>;

export const PartnershipSchema = z.strictObject({
  transactionSets: z.array(
    z.strictObject({
      description: z.string().optional(),
      sendingPartnerId: z.string(),
      receivingPartnerId: z.string(),
      usageIndicatorCode: UsageIndicatorCodeSchema,
      guideId: z.string(),
      destinations: z.array(DestinationSchema),
    })
  ),
  ack: AckSchema.default({ enabled: false }).optional(),
});

export type Partnership = z.infer<typeof PartnershipSchema>;

export const ISAPartnerIdLookupSchema = z.strictObject({
  partnerId: z.string(),
});
export type ISAPartnerIdLookup = z.infer<typeof ISAPartnerIdLookupSchema>;

export const PartnerProfileSchema = z.strictObject({
  id: z.string(),
  partnerName: z.string(),
  acknowledgmentRequestedCode: z.string(),
  partnerInterchangeQualifier: z.string(),
  partnerInterchangeId: z.string(),
  partnerApplicationId: z.string(),
});

export type PartnerProfile = z.infer<typeof PartnerProfileSchema>;
