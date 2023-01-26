import * as z from "zod";

export const OutboundEventSchema = z.strictObject({
  metadata: z.strictObject({
    sendingPartnerId: z.string(),
    receivingPartnerId: z.string(),
    transactionSet: z.string().optional(),
  }),
  payload: z.any(),
});

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;
