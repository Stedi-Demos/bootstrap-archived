import * as z from "zod";

export const EventInterchangeSchema = z.strictObject({
  acknowledgmentRequestedCode: z.enum(["0", "1", "2", "3"]),
  controlNumber: z.number(),
  date: z.string(),
  receiverId: z.string(),
  receiverQualifier: z.string().length(2),
  senderId: z.string(),
  senderQualifier: z.string().length(2),
  time: z.string(),
  usageIndicatorCode: z.enum(["P", "T", "I"]),
  versionNumberCode: z.string().length(5),
});

export type EventInterchange = z.infer<typeof EventInterchangeSchema>;
