import * as z from "zod";
import { UsageIndicatorCodeSchema } from "../generateControlNumber.js";

export const TransactionEventSchema = z.object({
  version: z.string(),
  id: z.string(),
  source: z.literal("stedi.engine"),
  "detail-type": z.literal("engine.inbound"),
  time: z.string(),
  region: z.string(),
  resources: z.array(z.string()),
  detail: z.object({
    version: z.literal("2023-02-13"),
    direction: z.literal("SENT").or(z.literal("RECEIVED")),
    metadata: z.object({
      interchange: z.object({
        controlNumber: z.string(),
      }),
      group: z.object({
        controlNumber: z.string(),
      }),
      processedAt: z.string(),
    }),
    transaction: z.object({
      controlNumber: z.string(),
      id: z.string(),
      usageIndicatorCode: UsageIndicatorCodeSchema,
      transactionSetIdentifier: z.string(),
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
