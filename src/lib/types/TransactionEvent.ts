import * as z from "zod";

export const UsageIndicatorCodeSchema = z.enum(["P", "T", "I"]);
export type UsageIndicatorCode = z.infer<typeof UsageIndicatorCodeSchema>;

export const TransactionEventSchema = z.object({
  version: z.string(),
  id: z.string(),
  source: z.literal("stedi.engine"),
  "detail-type": z.literal("transaction.processed"),
  time: z.string(),
  region: z.string(),
  resources: z.array(z.string()),
  detail: z.object({
    version: z.literal("2023-02-13"),
    direction: z.literal("SENT").or(z.literal("RECEIVED")),
    envelopes: z.object({
      interchange: z.object({
        acknowledgmentRequestedCode: z.string(),
        controlNumber: z.number(),
        date: z.string(),
        receiverId: z.string(),
        receiverQualifier: z.string(),
        senderId: z.string(),
        senderQualifier: z.string(),
        time: z.string(),
        usageIndicatorCode: UsageIndicatorCodeSchema,
        versionNumberCode: z.string(),
      }),
      functionalGroup: z.object({
        applicationReceiverCode: z.string(),
        applicationSenderCode: z.string(),
        controlNumber: z.number(),
        date: z.string(),
        functionalIdentifierCode: z.string(),
        release: z.string(),
        responsibleAgencyCode: z.string(),
        time: z.string(),
      }),
    }),
    transaction: z.object({
      controlNumber: z.number(),
      id: z.string(),
      transactionSetIdentifier: z.string(),
      ruleId: z.string(),
    }),
    metadata: z.object({
      processedAt: z.string(),
    }),
    input: z.object({
      type: z.string(),
      bucketName: z.string(),
      key: z.string(),
    }),
    output: z.object({
      type: z.string(),
      bucketName: z.string(),
      key: z.string(),
    }),
    partnership: z.object({
      partnershipId: z.string(),
      sender: z.object({
        isa: z.object({
          qualifier: z.string(),
          id: z.string(),
        }),
        profileId: z.string(),
      }),
      receiver: z.object({
        isa: z.object({
          qualifier: z.string(),
          id: z.string(),
        }),
        profileId: z.string(),
      }),
    }),
  }),
});

export type TransactionEvent = z.infer<typeof TransactionEventSchema>;

