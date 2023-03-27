import z from "zod";

import { DestinationSchema } from "./Destination.js";

export const UsageIndicatorCodeSchema = z.enum(["P", "T", "I"]);

export type UsageIndicatorCode = z.infer<typeof UsageIndicatorCodeSchema>;

const BaseTransactionSetSchema = z.strictObject({
  description: z.string().optional(),
  usageIndicatorCode: UsageIndicatorCodeSchema,
  destinations: z.array(DestinationSchema),
});

// dedicated schema for "997" ack transaction set:
// - no sender/receiver ids (inferred from the interchange being acknowledged)
// - no acknowledgmentConfig (can't ack an ack)
const AckTransactionSetSchema = BaseTransactionSetSchema.extend({
  transactionSetIdentifier: z.literal("997"),
});

export type AckTransactionSet = z.infer<typeof AckTransactionSetSchema>;

// ack configuration schema for all transactions other than AckTransactionSet
const AckSchema = z.strictObject({
  acknowledgmentType: z.literal("997"),
});

// base schema for all transaction sets _except_ AckTransactionSet:
// - includes sender/receiver ids
// - includes acknowledgmentConfig schema
const NonAckTransactionSetSchema = BaseTransactionSetSchema.extend({
  sendingPartnerId: z.string(),
  receivingPartnerId: z.string(),
  acknowledgmentConfig: AckSchema.optional(),
});

// base guide transaction sets
// - do not include `guideId`
// - must include `release` and `transactionSet` to determine base guide to use
const BaseGuideTransactionSetSchema = NonAckTransactionSetSchema.extend({
  // release: must be string representation of valid X12 release ([3-8]0[1-7]0)
  release: z.string().regex(/^[3-8]0[1-7]0$/),
  // transactionSetIdentifier must be string representation of 100-999 (excluding 997)
  transactionSetIdentifier: z.string().regex(/^(?!997)[1-9][0-9][0-9]$/),
});

// transaction sets without `guideId` can be either:
// - AckTransactionSet (no `release` included, `transactionSetIdentifier` === "997")
// - BaseGuideTransactionSet (`release` and `transactionSet` required, `transactionSetIdentifier` !== "997")
const TransactionSetWithoutGuideIdSchema = z.union([
  AckTransactionSetSchema,
  BaseGuideTransactionSetSchema,
]);

export type TransactionSetWithoutGuideId = z.infer<
  typeof TransactionSetWithoutGuideIdSchema
>;

// transaction sets with `guideId`:
// - no `release` or `transactionSetIdentifier` (inferred from guide)
const TransactionSetWithGuideIdSchema = NonAckTransactionSetSchema.extend({
  guideId: z.string(),
});

export type TransactionSetWithGuideId = z.infer<
  typeof TransactionSetWithGuideIdSchema
>;

const TransactionSetSchema = z.union([
  TransactionSetWithGuideIdSchema,
  TransactionSetWithoutGuideIdSchema,
]);

export type TransactionSet = z.infer<typeof TransactionSetSchema>;

export const PartnershipSchema = z.strictObject({
  transactionSets: z.array(TransactionSetSchema),
});

export type PartnershipInput = z.input<typeof PartnershipSchema>;

export type Partnership = z.infer<typeof PartnershipSchema>;

export const ISAPartnerIdLookupSchema = z.strictObject({
  partnerId: z.string(),
});
export type ISAPartnerIdLookup = z.infer<typeof ISAPartnerIdLookupSchema>;

export const PartnerProfileSchema = z.strictObject({
  id: z.string(),
  partnerName: z.string(),
  acknowledgmentRequestedCode: z.string(),
  partnerInterchangeQualifier: z.string(),
  partnerInterchangeId: z.string(),
  partnerApplicationId: z.string(),
});

export type PartnerProfile = z.infer<typeof PartnerProfileSchema>;

export const isTransactionSetWithGuideId = (
  transactionSet: TransactionSet
): transactionSet is TransactionSetWithGuideId => {
  return "guideId" in transactionSet;
};

export const isTransactionSetWithoutGuideId = (
  transactionSet: TransactionSet
): transactionSet is TransactionSetWithGuideId => {
  return "transactionSetIdentifier" in transactionSet;
};

export const isAckTransactionSet = (
  transactionSet: TransactionSet
): transactionSet is AckTransactionSet => {
  return (
    "transactionSetIdentifier" in transactionSet &&
    transactionSet.transactionSetIdentifier === "997"
  );
};

export const isNonAckTransactionSet = (
  transactionSet: TransactionSet
): transactionSet is AckTransactionSet => {
  return (
    "sendingPartnerId" in transactionSet &&
    "receivingPartnerId" in transactionSet
  );
};
