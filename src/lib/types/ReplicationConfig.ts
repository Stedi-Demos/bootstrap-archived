import z from "zod";

import { DestinationSchema } from "./Destination.js";

export const ReplicationConfigSchema = z.strictObject({
  destinations: z.array(DestinationSchema),
});
