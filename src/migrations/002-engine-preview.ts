import {
  DeleteValueCommand,
  ListValuesCommand,
  ValueOutput,
} from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
import { stashClient as stashClient } from "../lib/clients/stash.js";
import { saveDestinations } from "../lib/saveDestinations.js";
import {
  CreateInboundX12TransactionCommand,
  CreateOutboundX12TransactionCommand,
  CreateX12PartnershipCommand,
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../lib/clients/partners.js";
import { cloneDeep } from "lodash-es";
import { guidesClient } from "../lib/clients/guides.js";
import { GetGuideCommand } from "@stedi/sdk-client-guides";
import { gu } from "date-fns/locale";

const stash = stashClient();
const partners = partnersClient();
const guides = guidesClient();

export const up = async () => {
  console.log(
    "============================= migration 2 ---------------------"
  );
  const migratedStashPartnershipKeys: string[] = [];
  const migratedStashProfileKeys: string[] = [];

  await loadAllConfigValues(); // load all stash records once

  // create  Destinations from Partnerships
  const stashPartnerships = allStashPartnerships();

  for (const stashPartnership of stashPartnerships) {
    const destinationsId = stashPartnership.id.replace(
      "partnership|",
      "destinations|"
    );

    const stashPartnershipKey = stashPartnership.id;
    delete stashPartnership.id;
    saveDestinations(destinationsId, stashPartnership);

    // get "sending" profile from Stash
    const sendingStashProfile = findStashProfile(
      stashPartnership.transactionSets[0].sendingPartnerId
    );

    // prepare "local" profile in Partners API
    const localProfile: CreateX12ProfileCommandInput = {
      profileId: stashPartnership.transactionSets[0].sendingPartnerId,
      profileType: "local",
      interchangeQualifier: sendingStashProfile.partnerInterchangeQualifier,
      interchangeId: sendingStashProfile.partnerInterchangeId.padStart(15, " "),
      applicationId: sendingStashProfile.partnerApplicationId,
    };

    // get "receiving" profile from Stash
    const receivingStashProfile = findStashProfile(
      stashPartnership.transactionSets[0].receivingPartnerId
    );
    // prepare "partner" profile in Partners API
    const partnerProfile: CreateX12ProfileCommandInput = {
      profileId: stashPartnership.transactionSets[0].receivingPartnerId,
      profileType: "partner",
      interchangeQualifier: receivingStashProfile.partnerInterchangeQualifier,
      interchangeId: receivingStashProfile.partnerInterchangeId.padStart(
        15,
        " "
      ),
      applicationId: receivingStashProfile.partnerApplicationId,
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

    // create partnership
    const partnership = await partners.send(
      new CreateX12PartnershipCommand({
        localProfileId: localProfile.profileId,
        partnerProfileId: partnerProfile.profileId,
        partnershipId: `${localProfile.profileId}_${partnerProfile.profileId}`,
      })
    );

    for (const transactionSet of stashPartnership.transactionSets) {
      const guide = await guides.send(
        new GetGuideCommand({ id: transactionSet.guideId })
      );
      if (guide.target?.standard !== "x12") throw new Error("guide is not X12");

      if (transactionSet.sendingPartnerId == localProfile.profileId) {
        // Outbound

        await partners.send(
          new CreateOutboundX12TransactionCommand({
            partnershipId: partnership.partnershipId,
            timeZone: "UTC",
            release: guide.target.release,
            transactionSetIdentifier: guide.target.transactionSet,
            guideId: guide.id,
          })
        );
      } else {
        // Inbound
        await partners.send(
          new CreateInboundX12TransactionCommand({
            partnershipId: partnership.partnershipId,
            release: guide.target.release,
            transactionSetIdentifier: guide.target.transactionSet,
            guideId: guide.id,
            functionalAcknowledgmentConfig: {
              acknowledgmentType: "997",
              generate: "ALWAYS",
              groupBy: "ONE_PER_INTERCHANGE",
            },
          })
        );
      }
    }

    migratedStashPartnershipKeys.push(stashPartnershipKey);
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

let allConfigValues: ValueOutput[] = [];

const loadAllConfigValues = async () => {
  const { items } = await stash.send(
    new ListValuesCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
    })
  );

  if (items !== undefined) allConfigValues = items;
};

const allStashPartnerships = (): any[] => {
  return allConfigValues
    .filter((item) => item.key?.toLowerCase().startsWith("partnership|"))
    .map((item) => cloneDeep({ id: item.key, ...(item.value as object) }));
};

const findStashProfile = (id: string): any => {
  const profile = allConfigValues.find(
    (item) => item.key?.toLowerCase() === `profile|${id}`
  );

  if (
    profile === undefined ||
    profile.value === undefined ||
    typeof profile.value !== "object"
  )
    throw new Error(`Profile not found or invalid: ${id}`);

  return cloneDeep({ ...profile.value, id: profile.key });
};
