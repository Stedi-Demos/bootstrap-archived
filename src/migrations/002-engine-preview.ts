import {
  DeleteValueCommand,
  ListValuesCommand,
  SetValueCommand,
  ValueOutput,
} from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
import { stashClient as stashClient } from "../lib/clients/stash.js";
import { saveTransactionSetDestinations } from "../lib/saveTransactionSetDestinations.js";
import {
  CreateInboundX12TransactionCommand,
  CreateInboundX12TransactionCommandInput,
  CreateInboundX12TransactionCommandOutput,
  CreateOutboundX12TransactionCommand,
  CreateOutboundX12TransactionCommandOutput,
  CreateX12PartnershipCommand,
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../lib/clients/partners.js";
import { cloneDeep } from "lodash-es";
import { guidesClient } from "../lib/clients/guides.js";
import {
  GetGuideCommand,
  GetGuideCommandOutput,
} from "@stedi/sdk-client-guides";
import {
  PartnerProfile,
  Partnership,
  TransactionSetWithGuideId,
  isAckTransactionSet,
} from "../lib/types/Depreacted.js";
import { ensureGuideExists, parseGuideId } from "../support/guide.js";

const stash = stashClient();
const partners = partnersClient();
const guides = guidesClient();

export const up = async () => {
  const guide997 = await ensureGuideExists(
    "src/resources/X12/5010/997/guide.json"
  );
  const migratedStashPartnershipKeys: string[] = [];
  const migratedStashProfileKeys: string[] = [];

  await loadAllConfigValues(); // load all stash records once

  // create  Destinations from Partnerships
  const stashPartnerships = allStashPartnerships();

  for (const stashPartnership of stashPartnerships) {
    const txnSetWithProfile = stashPartnership.transactionSets.find(
      (txnSet) => "sendingPartnerId" in txnSet
    ) as TransactionSetWithGuideId;

    if (txnSetWithProfile === undefined)
      throw new Error("Failed to find transactionSet with profiles");

    // get "sending" profile from Stash
    const sendingStashProfile = findStashProfile(
      txnSetWithProfile.sendingPartnerId
    );

    // prepare "local" profile in Partners API
    const localProfile: CreateX12ProfileCommandInput = {
      profileId: txnSetWithProfile.sendingPartnerId,
      profileType: "local",
      interchangeQualifier: sendingStashProfile.partnerInterchangeQualifier,
      interchangeId: sendingStashProfile.partnerInterchangeId.padEnd(15, " "),
    };

    // get "receiving" profile from Stash
    const receivingStashProfile = findStashProfile(
      txnSetWithProfile.receivingPartnerId
    );

    // prepare "partner" profile in Partners API
    const partnerProfile: CreateX12ProfileCommandInput = {
      profileId: txnSetWithProfile.receivingPartnerId,
      profileType: "partner",
      interchangeQualifier: receivingStashProfile.partnerInterchangeQualifier,
      interchangeId: receivingStashProfile.partnerInterchangeId.padEnd(15, " "),
    };

    if (
      localProfile.profileId === undefined ||
      partnerProfile.profileId === undefined
    )
      throw new Error("localProfile or partnerProfile is invalid");

    // create local profile in Partners API
    await partners.send(new CreateX12ProfileCommand(localProfile));
    migratedStashProfileKeys.push(localProfile.profileId);

    // create partner profile in Partners API
    await partners.send(new CreateX12ProfileCommand(partnerProfile));
    migratedStashProfileKeys.push(partnerProfile.profileId);

    const generate997For: string[] = [];

    // create partnership
    const partnershipId = `${localProfile.profileId}_${partnerProfile.profileId}`;
    const partnership = await partners.send(
      new CreateX12PartnershipCommand({
        partnershipId,
        localProfileId: localProfile.profileId,
        partnerProfileId: partnerProfile.profileId,
      })
    );

    const ackConfig = stashPartnership.transactionSets.find((txnSet) =>
      isAckTransactionSet(txnSet)
    );

    if (ackConfig !== undefined) {
      const ackRule = await partners.send(
        new CreateOutboundX12TransactionCommand({
          partnershipId: partnership.partnershipId,
          timeZone: "UTC",
          release: guide997.target!.release,
          transactionSetIdentifier: guide997.target!.transactionSet,
          guideId: parseGuideId(guide997.id!),
        })
      );

      await stash.send(
        new SetValueCommand({
          keyspaceName: PARTNERS_KEYSPACE_NAME,
          key: `destinations|${partnershipId}|${ackRule.transactionSetIdentifier}`,
          value: {
            description: ackConfig.description!,
            destinations: ackConfig.destinations,
          },
        })
      );
    }

    for (const transactionSet of stashPartnership.transactionSets) {
      let guideId: string | undefined;
      let guideTarget: GetGuideCommandOutput["target"];

      if ("guideId" in transactionSet) {
        guideId = transactionSet.guideId; // NO DRFT_ OR LIVE_ PREFIX
        const guide = await guides.send(
          new GetGuideCommand({ id: `DRFT_${guideId}` })
        );
        if (guide.target?.standard !== "x12")
          throw new Error("guide is not X12");

        guideTarget = guide.target;
      } else {
        if (!("transactionSetIdentifier" in transactionSet))
          throw new Error("Unknown transactionSet configuration");

        if ("release" in transactionSet) {
          // base guides
          guideTarget = {
            standard: "x12",
            release: transactionSet.release,
            transactionSet: transactionSet.transactionSetIdentifier,
          };
        } else {
          // ack config
          // no transaction rule is needed so skip below
          continue;
        }
      }

      // does the current txn set want a 997
      if (
        "acknowledgmentConfig" in transactionSet &&
        transactionSet.acknowledgmentConfig?.acknowledgmentType === "997" &&
        guideTarget.transactionSet !== undefined
      )
        generate997For.push(guideTarget.transactionSet);

      let rule:
        | CreateOutboundX12TransactionCommandOutput
        | CreateInboundX12TransactionCommandOutput;

      if (
        "sendingPartnerId" in transactionSet &&
        transactionSet.sendingPartnerId == localProfile.profileId
      ) {
        // Outbound
        rule = await partners.send(
          new CreateOutboundX12TransactionCommand({
            partnershipId: partnership.partnershipId,
            timeZone: "UTC",
            release: guideTarget.release,
            transactionSetIdentifier: guideTarget.transactionSet,
            guideId,
          })
        );
      } else {
        // Inbound
        const params: CreateInboundX12TransactionCommandInput = {
          partnershipId: partnership.partnershipId,
          release: guideTarget.release,
          transactionSetIdentifier: guideTarget.transactionSet,
          guideId,
        };

        rule = await partners.send(
          new CreateInboundX12TransactionCommand(params)
        );
      }

      saveTransactionSetDestinations(
        `destinations|${partnershipId}|${rule.transactionSetIdentifier}`,
        {
          description: transactionSet.description!,
          destinations: transactionSet.destinations,
        }
      );
    }

    // record the txn sets we want to generate 997's for
    await stash.send(
      new SetValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `destinations|${partnershipId}|acknowledgments`,
        value: {
          generateFor: generate997For,
        },
      })
    );

    migratedStashPartnershipKeys.push(stashPartnership.id!);
  }

  /// CLEANUP AFTER ALL SUCCESSFUL MIGRATION

  // delete partnerships from Stash
  for (const migratedStashPartnershipKey of migratedStashPartnershipKeys) {
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `${migratedStashPartnershipKey}`,
      })
    );
  }

  // delete profiles from Stash
  for (const migratedStashProfileKey of migratedStashProfileKeys) {
    const profile = findStashProfile(migratedStashProfileKey);

    // delete ISA lookup from Stash
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `lookup|ISA|${profile.partnerInterchangeQualifier}/${profile.partnerInterchangeId}`,
      })
    );

    // delete profile from Stash
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `profile|${migratedStashProfileKey}`,
      })
    );
  }
};

const allConfigValues: ValueOutput[] = [];

const loadAllConfigValues = async () => {
  let recordsRemaining = true;
  while (recordsRemaining) {
    const { items, nextPageToken } = await stash.send(
      new ListValuesCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
      })
    );

    if (items === undefined) return;

    allConfigValues.push(...items);

    recordsRemaining = nextPageToken !== undefined;
  }
};

type PartnershipWithId = Partnership & { id?: string };
const allStashPartnerships = (): PartnershipWithId[] => {
  return allConfigValues
    .filter((item) => item.key?.toLowerCase().startsWith("partnership|"))
    .map((item) =>
      cloneDeep({
        id: item.key,
        ...(item.value as Partnership),
      })
    );
};

const findStashProfile = (id?: string): PartnerProfile => {
  if (id === undefined) throw new Error("Profile ID is undefined");

  const profile = allConfigValues.find(
    (item) => item.key?.toLowerCase() === `profile|${id}`
  );

  if (
    profile === undefined ||
    profile.value === undefined ||
    typeof profile.value !== "object"
  )
    throw new Error(`Profile not found or invalid: ${id}`);

  return cloneDeep({ ...profile.value, id: profile.key }) as PartnerProfile;
};
