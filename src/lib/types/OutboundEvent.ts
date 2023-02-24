import * as z from "zod";

export const OutboundEventSchema = z.strictObject({
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
  payload: z.any(),
});

export type OutboundEvent = z.infer<typeof OutboundEventSchema>;
