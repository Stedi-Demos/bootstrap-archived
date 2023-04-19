import z from "zod";
import {
  DestinationWebhook,
  DestinationWebhookSchema,
} from "./DestinationWebhook.js";
import { DestinationAS2Schema } from "./DestinationAS2.js";
import { DestinationBucketSchema } from "./DestinationBucket.js";
import { DestinationFunctionSchema } from "./DestinationFunction.js";
import { DestinationSftpSchema } from "./DestinationSftp.js";
import { DestinationStashSchema } from "./DestinationStash.js";
import { DestinationAck, DestinationAckSchema } from "./DestinationAck.js";

type WebhookVerb = DestinationWebhook["verb"];

// custom definition in order to use discriminated union with good types, not
// possible using json-schema-to-zod
const DestinationSchema = z.strictObject({
  mappingId: z.string().optional(),
  mappingValidation: z.enum(["strict"]).optional(),
  usageIndicatorCode: z
    .enum(["P", "T", "I"])
    .optional()
    .describe(
      "configure destination to receive the transaction set only when the envelope usage indicator code matches the supplied value"
    ),
  release: z
    .string()
    .min(6)
    .max(12)
    .optional()
    .describe(
      "configure destination to receive the transaction set only when the envelope release matches the supplied value"
    ),
  destination: z.discriminatedUnion("type", [
    DestinationAS2Schema,
    DestinationBucketSchema,
    DestinationFunctionSchema,
    DestinationSftpSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
  ]),
});

const TransactionSetDestinationsSchema = z.strictObject({
  $schema: z.string().optional(),
  description: z.string().optional(),
  destinations: z.array(DestinationSchema),
});

type TransactionSetDestinations = z.input<
  typeof TransactionSetDestinationsSchema
>;

const destinationAckKey = (partnershipId: string) =>
  `functional_acknowledgments|${partnershipId}`;

const destinationExecutionErrorKey = "destinations|errors|execution";

const destinationFileErrorEventsKey = "destinations|errors|file_error";

// custom definition in order to use discriminated union with good types, not
// possible using json-schema-to-zod
const DestinationErrorSchema = z.strictObject({
  description: z.string().optional(),
  mappingId: z.string().optional(),
  destination: z.discriminatedUnion("type", [
    DestinationFunctionSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
    DestinationBucketSchema,
  ]),
});

const DestinationErrorEventsSchema = z.strictObject({
  $schema: z.string().optional(),
  description: z.string().optional(),
  destinations: z.array(DestinationErrorSchema),
});

type DestinationErrorEvents = z.infer<typeof DestinationErrorEventsSchema>;

export {
  destinationAckKey,
  destinationExecutionErrorKey,
  destinationFileErrorEventsKey,
  TransactionSetDestinationsSchema,
  TransactionSetDestinations,
  DestinationAckSchema,
  DestinationAck,
  DestinationErrorEventsSchema,
  DestinationErrorEvents,
  WebhookVerb,
};
