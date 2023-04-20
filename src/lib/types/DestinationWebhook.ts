// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationWebhookSchema = z
  .object({
    type: z.literal("webhook"),
    url: z.string(),
    verb: z.enum(["PATCH", "POST", "PUT"]).default("POST"),
    headers: z.record(z.string()).optional(),
  })
  .strict();

export type DestinationWebhook = z.infer<typeof DestinationWebhookSchema>;
