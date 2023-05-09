// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationWebhookSchema = z
  .object({
    type: z.literal("webhook"),
    additionalInput: z
      .record(z.any())
      .describe(
        "Additional properties sent to the webhook as top-level properties. When applied to outbound EDI, the EDI string will be in the 'payload' property"
      )
      .optional(),
    includeSource: z
      .literal(true)
      .describe(
        "When set, transaction sets will also send the 'source' property to the destination, either the inbound EDI file, the triggering event, or the function input"
      )
      .optional(),
    url: z.string(),
    verb: z.enum(["PATCH", "POST", "PUT"]).default("POST"),
    headers: z.record(z.string()).optional(),
  })
  .strict();

export type DestinationWebhook = z.infer<typeof DestinationWebhookSchema>;
