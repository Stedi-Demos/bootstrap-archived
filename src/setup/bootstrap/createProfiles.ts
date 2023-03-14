import { GetGuideCommandOutput } from "@stedi/sdk-client-guides";
import {
  CreateInboundX12TransactionCommand,
  CreateInboundX12TransactionCommandOutput,
  CreateOutboundX12TransactionCommand,
  CreateX12PartnershipCommand,
  CreateX12PartnershipCommandOutput,
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
  GetInboundX12TransactionCommandOutput,
  GetX12PartnershipCommand,
  GetX12PartnershipCommandOutput,
  InboundX12TransactionSummary,
  OutboundX12TransactionSummary,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../../lib/clients/partners.js";

export const createProfiles = async ({
  guide850,
  guide855,
}: {
  guide850: GetGuideCommandOutput;
  guide855: GetGuideCommandOutput;
}) => {
  const localProfile: CreateX12ProfileCommandInput = {
    profileId: "this-is-me-inc",
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

  const partners = partnersClient();
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

  let rule855: OutboundX12TransactionSummary | undefined;

  try {
    rule855 = (await partners.send(
      new CreateInboundX12TransactionCommand({
        partnershipId,
        release: guide855.target!.release,
        transactionSetIdentifier: guide855.target!.transactionSet,
        guideId: guide855.id,
      })
    )) as object as OutboundX12TransactionSummary;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceConflictException"
    ) {
      if ("outboundTransactions" in partnership) {
        rule855 = partnership.outboundTransactions?.find(
          (txn) =>
            txn.transactionSetIdentifier === guide855.target!.transactionSet
        );
      } else throw error;
    } else throw error;
  }

  if (rule855 === undefined) throw new Error("Rule 855 not found");

  // outbound 850

  let rule850: InboundX12TransactionSummary | undefined;

  try {
    rule850 = await partners.send(
      new CreateOutboundX12TransactionCommand({
        partnershipId,
        timeZone: "UTC",
        release: guide850.target!.release,
        transactionSetIdentifier: guide850.target!.transactionSet,
        guideId: guide850.id,
      })
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceConflictException"
    ) {
      if ("inboundTransactions" in partnership) {
        rule850 = partnership.inboundTransactions?.find(
          (txn) =>
            txn.transactionSetIdentifier === guide850.target!.transactionSet
        );
      } else throw error;
    } else throw error;
  }

  if (rule850 === undefined) throw new Error("Rule 850 not found");

  return { rule850, rule855 };
};
