import * as z from "zod";

export const BootstrapMetadataSchema = z.strictObject({
  resources: z.strictObject({
    GUIDE_IDS: z.array(z.string()).optional(),
    SFTP_BUCKET_NAME: z.string().optional(),
    EXECUTIONS_BUCKET_NAME: z.string().optional(),
    PROFILE_IDS: z.array(z.string()).optional(),
    PARTNERSHIP_IDS: z.array(z.string()).optional(),
    FUNCTION_NAMES: z.array(z.string()).optional(),
    EVENT_BINDING_NAMES: z.array(z.string()).optional(),
  }),
});

export type BootstrapMetadata = z.infer<typeof BootstrapMetadataSchema>;
