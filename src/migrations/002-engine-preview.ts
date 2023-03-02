import {
  DeleteValueCommand,
  ListValuesCommand,
  ValueOutput,
} from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../lib/constants.js";
import { stashClient as stashClient } from "../lib/clients/stash.js";
import { saveDestinations } from "../lib/saveDestinations.js";
import {
  CreateX12ProfileCommand,
  CreateX12ProfileCommandInput,
} from "@stedi/sdk-client-partners";
import { partnersClient } from "../lib/clients/partners.js";
import { cloneDeep } from "lodash-es";

const stash = stashClient();
const partners = partnersClient();

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

    for (const transactionSet of stashPartnership.transactionSets) {
    }

    migratedStashPartnershipKeys.push(stashPartnershipKey);
  }

  // move profiles from stash to Partners API

  /// CLEANUP AFTER ALL SUCCESSFUL MIGRATION

  // delete partnerships from Stash
  for (const migratedStashPartnershipKey of migratedStashPartnershipKeys) {
    console.log(migratedStashPartnershipKey);
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `partnership|${migratedStashPartnershipKey}`,
      })
    );
  }

  // delete profiles from Stash
  for (const migratedStashProfileKey of migratedStashProfileKeys) {
    console.log(migratedStashProfileKey);
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
