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
