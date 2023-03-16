import * as z from "zod";
import { EventFunctionalGroupSchema } from "../../../lib/types/EventFunctionalGroup";
import { EventInterchangeSchema } from "../../../lib/types/EventInterchange";

export const EngineFunctionalGroupTranslationSucceededEventSchema =
  z.strictObject({
    source: z.literal("stedi.engine"),
    ["detail-type"]: z.literal("functional_group.translation_succeeded"),
    detail: z.strictObject({
      version: z.literal("2023-02-13"),
      // TODO: not yet implemented in Engine 2023/03/20
      direction: z.enum(["SENT", "RECEIVED"]),
      envelopes: z.strictObject({
        interchange: EventInterchangeSchema,
        functionalGroup: EventFunctionalGroupSchema,
      }),
      transactionSetIds: z.array(z.string()),
      transactionSetCount: z.number(),
      input: z.strictObject({
        type: z.literal("EDI/X12"),
        bucketName: z.string(),
        key: z.string(),
      }),
      partnership: z.strictObject({
        partnershipId: z.string(),
        sender: z.strictObject({
          profileId: z.string(),
          isa: z.strictObject({
            id: z.string(),
            qualifier: z.string().length(2),
          }),
        }),
        receiver: z.strictObject({
          profileId: z.string(),
          isa: z.strictObject({
            id: z.string(),
            qualifier: z.string().length(2),
          }),
        }),
      }),
    }),
  });

export type EngineFunctionalGroupTranslationSucceededEvent = z.infer<
  typeof EngineFunctionalGroupTranslationSucceededEventSchema
>;

type TransactionSetId = string;
export interface StashPartnerDestinationAcks {
  generateFor: TransactionSetId[];
}
