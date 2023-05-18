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
  description: z.string().optional(),
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
  direction: z
    .enum(["inbound", "outbound"])
    .optional()
    .describe(
      "optional, the destination will only be used when the EDI document is in the specified direction. Used in edi-inbound and edi-outbound."
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
  mappingValidation: z.enum(["strict"]).optional(),
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

const destinationCsvFromJsonEventsKey = "destinations|csv|from-json";

// custom definition in order to use discriminated union with good types, not
// possible using json-schema-to-zod
const DestinationCsvFromJsonSchema = z.strictObject({
  description: z.string().optional(),
  mappingId: z.string().optional(),
  mappingValidation: z.enum(["strict"]).optional(),
  filter: z
    .strictObject({
      bucketName: z.string().optional(),
      pathPrefix: z.string().optional(),
    })
    .optional(),
  parserConfig: z
    .strictObject({
      header: z.boolean().default(true),
      delimiter: z.string().default(","),
      newline: z.string().default("\r\n"),
    })
    .optional(),
  destination: z.discriminatedUnion("type", [
    DestinationAS2Schema,
    DestinationBucketSchema,
    DestinationFunctionSchema,
    DestinationSftpSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
  ]),
});

type DestinationCsvFromJson = z.output<typeof DestinationCsvFromJsonSchema>;

const DestinationCsvFromJsonEventsSchema = z.strictObject({
  $schema: z.string().optional(),
  description: z.string().optional(),
  destinations: z.array(DestinationCsvFromJsonSchema),
});

type DestinationCsvFromJsonEvents = z.infer<
  typeof DestinationCsvFromJsonEventsSchema
>;

const destinationCsvToJsonEventsKey = "destinations|csv|to-json";

// custom definition in order to use discriminated union with good types, not
// possible using json-schema-to-zod
const DestinationCsvToJsonSchema = z.strictObject({
  description: z.string().optional(),
  mappingId: z.string().optional(),
  mappingValidation: z.enum(["strict"]).optional(),
  filter: z
    .strictObject({
      bucketName: z.string().optional(),
      pathPrefix: z.string().optional(),
    })
    .optional(),
  parserConfig: z
    .strictObject({
      delimiter: z.string().optional(),
      header: z.boolean().default(true),
      newline: z.enum(["\r", "\n", "\r\n"]).optional(),
      quoteChar: z.string().default('"'),
      skipEmptyLines: z.boolean().default(true),
      trim: z.boolean().default(false),
    })
    .optional(),

  destination: z.discriminatedUnion("type", [
    DestinationAS2Schema,
    DestinationBucketSchema,
    DestinationFunctionSchema,
    DestinationSftpSchema,
    DestinationWebhookSchema,
    DestinationStashSchema,
  ]),
});

type DestinationCsvToJson = z.output<typeof DestinationCsvToJsonSchema>;

const DestinationCsvToJsonEventsSchema = z.strictObject({
  $schema: z.string().optional(),
  description: z.string().optional(),
  destinations: z.array(DestinationCsvToJsonSchema),
});

type DestinationCsvToJsonEvents = z.infer<
  typeof DestinationCsvToJsonEventsSchema
>;

export {
  destinationAckKey,
  destinationCsvFromJsonEventsKey,
  destinationCsvToJsonEventsKey,
  destinationExecutionErrorKey,
  destinationFileErrorEventsKey,
  TransactionSetDestinationsSchema,
  TransactionSetDestinations,
  DestinationAckSchema,
  DestinationAck,
  DestinationCsvFromJson,
  DestinationCsvToJson,
  DestinationErrorEventsSchema,
  DestinationErrorEvents,
  DestinationCsvFromJsonEventsSchema,
  DestinationCsvToJsonEventsSchema,
  DestinationCsvFromJsonEvents,
  DestinationCsvToJsonEvents,
  WebhookVerb,
};
