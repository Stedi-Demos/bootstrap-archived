import * as z from "zod";
import { UsageIndicatorCodeSchema } from "../generateControlNumber";

export const OutboundEventSchema = z.strictObject({
  metadata: z.strictObject({
    partnershipId: z.string(),
    transactionSet: z.string().optional(),
    usageIndicatorCode: UsageIndicatorCodeSchema,
  }),
  payload: z.any(),
});

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;
