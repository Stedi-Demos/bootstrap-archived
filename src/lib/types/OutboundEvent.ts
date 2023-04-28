import * as z from "zod";
import { UsageIndicatorCodeSchema } from "./TransactionEvent.js";

export const OutboundEventSchema = z.strictObject({
  metadata: z.strictObject({
    partnershipId: z.string(),
    transactionSet: z.string().optional(),
    release: z.string().optional(),
    usageIndicatorCode: UsageIndicatorCodeSchema,
    useBuiltInGuide: z
      .boolean()
      .optional()
      .describe("Built-in guide available for 997 transaction set"),
  }),
  payload: z
    .unknown()
    .describe(
      "object matching the schema of the transaction set guide, or a payload to a mapping which will produce a valid object for the guide."
    ),
});

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;

// this type is used for detecting legacy function input
// this will be retired in a future version
//
export const LegacyOutboundEventSchema = z.strictObject({
  metadata: z.strictObject({
    sendingPartnerId: z.string(),
    receivingPartnerId: z.string(),
    transactionSet: z.string().optional(),
    release: z
      .string()
      .optional()
      .describe(
        "selects a guide with a specific release when multiple guides are configured for the same transaction set"
      ),
  }),
  payload: z.array(z.unknown()).or(z.record(z.unknown())).or(z.string()),
});

export type LegacyOutboundEvent = z.infer<typeof OutboundEventSchema>;
