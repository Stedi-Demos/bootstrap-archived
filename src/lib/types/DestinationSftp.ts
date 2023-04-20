// generated from /scripts/schema-zod-types.ts#generateZod
import { z } from "zod";

export const DestinationSftpSchema = z
  .object({
    type: z.literal("sftp"),
    connectionDetails: z
      .object({
        host: z.string(),
        port: z.number().default(22),
        username: z.string(),
        password: z.string().optional(),
        privateKey: z.string().optional(),
        passphrase: z.string().optional(),
      })
      .strict(),
    remotePath: z.string().optional(),
  })
  .strict();

export type DestinationSftp = z.infer<typeof DestinationSftpSchema>;
