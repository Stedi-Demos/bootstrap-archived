import z from "zod";

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

export type Destination = z.infer<typeof DestinationSchema>;

export const PartnershipSchema = z.strictObject({
  transactionSets: z.array(
    z.strictObject({
      description: z.string().optional(),
      sendingPartnerId: z.string(),
      receivingPartnerId: z.string(),
      usageIndicatorCode: z.union([
        z.literal("P"),
        z.literal("T"),
        z.literal("I"),
      ]),
      guideId: z.string(),
      destinations: z.array(DestinationSchema),
    })
  ),
});

export type Partnership = z.infer<typeof PartnershipSchema>;

export const ISAPartnerIdLookupSchema = z.strictObject({
  partnerId: z.string(),
});
export type ISAPartnerIdLookup = z.infer<typeof ISAPartnerIdLookupSchema>;

export const PartnerProfleSchema = z.strictObject({
  id: z.string(),
  partnerName: z.string(),
  x12: z.strictObject({
    acknowledgementRequestedCode: z.string(),
    partnerInterchangeQualifier: z.string(),
    partnerInterchangeId: z.string(),
    partnerApplicationId: z.string(),
  }),
});

export type PartnerProfile = z.infer<typeof PartnerProfleSchema>;
