import { z } from "zod";

import { DestinationBucketSchema } from "./Destination.js";

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

const ConnectionDetailsSchema = z.discriminatedUnion("protocol", [
  z.strictObject({
    protocol: z.literal("ftp"),
    config: FtpConfigSchema,
  }),
  z.strictObject({
    protocol: z.literal("sftp"),
    config: SftpConfigSchema,
  }),
]);

export type ConnectionDetails = z.infer<typeof ConnectionDetailsSchema>;

export const RemotePollerConfigSchema = z.strictObject({
  connectionDetails: ConnectionDetailsSchema,
  remotePath: z.string().default("/"),
  // can be used to poll for specific files (default is to retrieve all files)
  remoteFiles: z.array(z.string()).optional(),
  destination: DestinationBucketSchema,
  deleteAfterProcessing: z.boolean().default(false),
  lastPollTime: z
  .string()
  .optional()
  .transform((lastPollTime) =>
    lastPollTime ? new Date(lastPollTime) : undefined
  ),
});

export type RemotePollerConfig = z.infer<typeof RemotePollerConfigSchema>;

export const RemotePollerConfigMapSchema = z.record(RemotePollerConfigSchema);

export type RemotePollerConfigMap = z.infer<typeof RemotePollerConfigMapSchema>;
