// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationStashSchema = z
  .object({
    type: z.literal("stash"),
    keyspaceName: z.string(),
    keyPrefix: z.string().optional(),
  })
  .strict();

export type DestinationStash = z.infer<typeof DestinationStashSchema>;
