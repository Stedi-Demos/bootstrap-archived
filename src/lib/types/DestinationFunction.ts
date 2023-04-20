// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationFunctionSchema = z
  .object({
    type: z.literal("function"),
    functionName: z.string(),
    additionalInput: z.record(z.any()).optional(),
  })
  .strict();

export type DestinationFunction = z.infer<typeof DestinationFunctionSchema>;
