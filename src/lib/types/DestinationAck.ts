// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationAckSchema = z
  .object({
    $schema: z.string().optional(),
    generateFor: z.array(z.string().describe("Transaction Set Id")),
  })
  .strict();

export type DestinationAck = z.infer<typeof DestinationAckSchema>;
