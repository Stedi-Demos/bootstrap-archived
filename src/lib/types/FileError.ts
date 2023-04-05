import * as z from "zod";
import { EventInterchangeSchema } from "./EventInterchange.js";

export const CoreFileErrorSchema = z.object({
  detail: z.object({
    version: z.literal("2023-02-13"),
    fileId: z.string(),
    direction: z.enum(["SENT", "RECEIVED", "UNKNOWN"]),
    envelopes: z
      .object({
        interchange: EventInterchangeSchema,
      })
      .optional(),
    input: z.object({
      type: z.string().describe(`"EDI/X12", "STEDI/GUIDE-JSON", or other`),
      bucketName: z.string(),
      key: z.string(),
    }),
    errors: z.array(z.unknown()),
  }),
  "detail-type": z.literal("file.failed"),
  source: z.literal("stedi.core"),
});

export type CoreFileError = z.infer<typeof CoreFileErrorSchema>;
