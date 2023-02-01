import { z } from "zod";

const FtpConfigSchema = z.strictObject({
  host: z.string(),
  port: z.number().default(21),
  user: z.string(),
  password: z.string(),
  secure: z.union([z.boolean(), z.literal("implicit")]),
  secureOptions: z.object({
    rejectUnauthorized: z.boolean(),
  }),
});

const SftpConfigSchema = z.strictObject({
  host: z.string(),
  port: z.number().default(22),
  username: z.string(),
  password: z.string(),
});

const ConnectionDetails = z.discriminatedUnion("protocol", [
  z.strictObject({
    protocol: z.literal("ftp"),
    config: FtpConfigSchema,
  }),
  z.strictObject({
    protocol: z.literal("sftp"),
    config: SftpConfigSchema,
  }),
]);

export const FtpPollerConfigSchema = z.strictObject({
  connectionDetails: ConnectionDetails,
  remotePath: z.string().default("/"),
  // can be used to poll for specific files (default is to retrieve all files)
  remoteFiles: z.array(z.string()).optional(),
  destinationPath: z.string(),
  deleteAfterProcessing: z.boolean().default(false),
  lastPollTime: z
  .string()
  .optional()
  .transform((lastPollTime) =>
    lastPollTime ? new Date(lastPollTime) : undefined
  ),
});

export type FtpPollerConfig = z.infer<typeof FtpPollerConfigSchema>;

export const FtpPollerConfigMap = z.record(FtpPollerConfigSchema);

export type FtpPollerConfigMap = z.infer<typeof FtpPollerConfigMap>;
