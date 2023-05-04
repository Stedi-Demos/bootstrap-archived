import { z } from "zod";
import { DestinationFunctionSchema } from "../../../lib/types/DestinationFunction.js";
import { DestinationWebhookSchema } from "../../../lib/types/DestinationWebhook.js";

export const ConfigurationSchema = z
  .object({
    $schema: z.string().optional(),
    description: z.string().optional(),
    destinations: z.array(
      z.object({
        description: z.string().optional(),
        threshold: z.number(),
        destination: z.discriminatedUnion("type", [
          DestinationFunctionSchema,
          DestinationWebhookSchema,
        ]),
      })
    ),
  })
  .strict();

export type Configuration = z.infer<typeof ConfigurationSchema>;
