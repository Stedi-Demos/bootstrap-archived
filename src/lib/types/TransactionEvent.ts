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
    metadata: z.object({
      interchange: z.object({
        controlNumber: z.string(),
        usageIndicatorCode: UsageIndicatorCodeSchema,
      }),
      group: z.object({
        controlNumber: z.string(),
      }),
      processedAt: z.string(),
    }),
    transaction: z.object({
      controlNumber: z.string(),
      id: z.string(),
      transactionSetIdentifier: z.string(),
      ruleId: z.string(),
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
