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
    fileExtention: z
      .string()
      .regex(new RegExp("^(?!\\.).+"))
      .describe(
        "defaults to 'edi', 'json', or 'csv', depending on output file type. Do not include a leading dot"
      )
      .optional(),
  })
  .strict();

export type DestinationAS2 = z.infer<typeof DestinationAS2Schema>;
