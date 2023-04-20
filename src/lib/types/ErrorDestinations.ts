// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const ErrorDestinationsSchema = z
  .object({
    $schema: z.string().optional(),
    description: z.string().optional(),
    destinations: z.array(
      z
        .object({
          description: z.string().optional(),
          mappingId: z.string().optional(),
          mappingValidation: z.enum(["strict"]).optional(),
          destination: z.any().superRefine((x, ctx) => {
            const schemas = [
              z
                .object({
                  type: z.literal("bucket"),
                  bucketName: z.string(),
                  path: z.string(),
                  baseFilename: z.string().optional(),
                })
                .strict(),
              z
                .object({
                  type: z.literal("function"),
                  functionName: z.string(),
                  additionalInput: z.record(z.any()).optional(),
                })
                .strict(),
              z
                .object({
                  type: z.literal("stash"),
                  keyspaceName: z.string(),
                  keyPrefix: z.string().optional(),
                })
                .strict(),
              z
                .object({
                  type: z.literal("webhook"),
                  url: z.string(),
                  verb: z.enum(["PATCH", "POST", "PUT"]).default("POST"),
                  headers: z.record(z.string()).optional(),
                })
                .strict(),
            ];
            const errors = schemas.reduce(
              (errors: z.ZodError[], schema) =>
                ((result) =>
                  "error" in result ? [...errors, result.error] : errors)(
                  schema.safeParse(x)
                ),
              []
            );
            if (schemas.length - errors.length !== 1) {
              ctx.addIssue({
                path: ctx.path,
                code: "invalid_union",
                unionErrors: errors,
                message: "Invalid input: Should pass single schema",
              });
            }
          }),
        })
        .strict()
    ),
  })
  .strict();

export type ErrorDestinations = z.infer<typeof ErrorDestinationsSchema>;
