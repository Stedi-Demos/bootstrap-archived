import { GetGuideCommandOutput } from "@stedi/sdk-client-guides";
import {
  CreateInboundX12TransactionCommand,
  CreateOutboundX12TransactionCommand,
  CreateX12PartnershipCommand,
  CreateX12PartnershipCommandOutput,
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
  GetX12PartnershipCommand,
  GetX12PartnershipCommandOutput,
  InboundX12TransactionSummary,
  OutboundX12TransactionSummary,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../../lib/clients/partners.js";
import { parseGuideId } from "../../support/guide.js";

const partners = partnersClient();

export const createProfiles = async ({
  guide850,
  guide855,
  guide997,
}: {
  guide850: GetGuideCommandOutput;
  guide855: GetGuideCommandOutput;
  guide997: GetGuideCommandOutput;
}) => {
  const localProfile: CreateX12ProfileCommandInput = {
    profileId: "this-is-me",
    profileType: "local",
    interchangeQualifier: "ZZ",
    interchangeId: "THISISME".padEnd(15, " "),
  };
  const remoteProfile: CreateX12ProfileCommandInput = {
    profileId: "another-merchant",
    profileType: "partner",
    interchangeQualifier: "14",
    interchangeId: "ANOTHERMERCH".padEnd(15, " "),
  };

  console.log("Creating X12 Trading Partner Profile in Partners API");

  for (const profile of [localProfile, remoteProfile]) {
    try {
      await partners.send(new CreateX12ProfileCommand(profile));
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "ResourceConflictException"
      )
        console.log("Partner profile already exists");
      else throw error;
    }
  }

  let partnership:
    | CreateX12PartnershipCommandOutput
    | GetX12PartnershipCommandOutput
    | undefined;
  const partnershipId = `${localProfile.profileId}_${remoteProfile.profileId}`;

  try {
    partnership = await partners.send(
      new CreateX12PartnershipCommand({
        partnershipId,
        localProfileId: localProfile.profileId,
        partnerProfileId: remoteProfile.profileId,
        functionalAcknowledgmentConfig: {
          acknowledgmentType: "997",
          generate: "ALWAYS",
          groupBy: "ONE_PER_INTERCHANGE",
        },
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceConflictException"
    ) {
      partnership = await partners.send(
        new GetX12PartnershipCommand({
          partnershipId,
        })
      );
      console.log("Partnership already exists");
    } else throw error;
  }

  // create transaction set rules

  // inbound

  let rule855: InboundX12TransactionSummary | undefined;

  try {
    rule855 = await partners.send(
      new CreateInboundX12TransactionCommand({
        partnershipId,
        release: guide855.target!.release,
        transactionSetIdentifier: guide855.target!.transactionSet,
        guideId: parseGuideId(guide855.id!),
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error.name === "ResourceConflictException" ||
        (error.name === "BadRequestException" &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.includes("conflicts with transaction")))
    ) {
      if ("inboundTransactions" in partnership) {
        rule855 = partnership.inboundTransactions?.find(
          (txn) =>
            txn.transactionSetIdentifier === guide855.target!.transactionSet
        );
      } else
        throw new Error("Partnership does not contain inboundTransactions");
    } else throw error;
  }

  if (rule855 === undefined) throw new Error("Rule 855 not found");

  const rule850 = await ensureOutboundTransaction({
    guide: guide850,
    partnership,
  });

  const rule997 = await ensureOutboundTransaction({
    guide: guide997,
    partnership,
  });

  return { rule850, rule855, rule997 };
};

const ensureOutboundTransaction = async ({
  guide,
  partnership,
}: {
  guide: GetGuideCommandOutput;
  partnership:
    | CreateX12PartnershipCommandOutput
    | GetX12PartnershipCommandOutput;
}) => {
  let rule: OutboundX12TransactionSummary | undefined;

  try {
    rule = await partners.send(
      new CreateOutboundX12TransactionCommand({
        partnershipId: partnership.partnershipId,
        timeZone: "UTC",
        release: guide.target!.release,
        transactionSetIdentifier: guide.target!.transactionSet,
        guideId: parseGuideId(guide.id!),
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error.name === "ResourceConflictException" ||
        (error.name === "BadRequestException" &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.includes("conflicts with transaction")))
    ) {
      if ("outboundTransactions" in partnership) {
        rule = partnership.outboundTransactions?.find(
          (txn) => txn.transactionSetIdentifier === guide.target!.transactionSet
        );
      } else
        throw new Error("Partnership does not contain outboundTransactions");
    } else throw error;
  }

  if (rule === undefined)
    throw new Error(
      `Failed to create rule for ${guide.target!.transactionSet}`
    );

  return rule;
};
