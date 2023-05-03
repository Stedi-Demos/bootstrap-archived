// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const ConfigurationSchema = z
  .object({
    $schema: z.string().optional(),
    description: z.string().optional(),
    destinations: z.array(
      z
        .object({
          description: z.string().optional(),
          threshold: z.number().gte(1).describe("the"),
          destination: z
            .object({
              type: z.literal("webhook"),
              url: z.string(),
              verb: z.enum(["PATCH", "POST", "PUT"]).default("POST"),
              headers: z.record(z.string()).optional(),
            })
            .strict(),
        })
        .strict()
    ),
  })
  .strict();

export type Configuration = z.infer<typeof ConfigurationSchema>;
