import * as z from "zod";
import { EventInterchangeSchema } from "./EventInterchange.js";
import { EventPartnershipSchema } from "./EventPartnership.js";
import { EventFunctionalGroupSchema } from "./EventFunctionalGroup.js";

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
      interchange: EventInterchangeSchema,
      functionalGroup: EventFunctionalGroupSchema,
    }),
    transaction: z.object({
      controlNumber: z.number(),
      id: z.string(),
      transactionSetIdentifier: z.string(),
      ruleId: z.string().optional(),
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
    partnership: EventPartnershipSchema,
  }),
});

export type TransactionEvent = z.infer<typeof TransactionEventSchema>;
