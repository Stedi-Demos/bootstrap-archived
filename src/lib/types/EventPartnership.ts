import * as z from "zod";

export const EventPartnershipSchema = z.strictObject({
  partnershipId: z.string(),
  sender: z.object({
    isa: z.object({
      qualifier: z.string().length(2),
      id: z.string(),
    }),
    profileId: z.string(),
  }),
  receiver: z.object({
    isa: z.object({
      qualifier: z.string().length(2),
      id: z.string(),
    }),
    profileId: z.string(),
  }),
});

export type EventPartnership = z.infer<typeof EventPartnershipSchema>;
