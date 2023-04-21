// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationAS2Schema = z
  .object({
    type: z.literal("as2"),
    connectorId: z.string(),
    bucketName: z.string(),
    path: z.string(),
    baseFilename: z
      .string()
      .describe("Optional prefix added to output file")
      .optional(),
  })
  .strict();

export type DestinationAS2 = z.infer<typeof DestinationAS2Schema>;
