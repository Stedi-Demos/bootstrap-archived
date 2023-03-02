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
  const migratedStashProfileKeys: string[] = [];

  await loadAllConfigValues(); // load all stash records once

  // create  Destinations from Partnerships
  const stashPartnerships = allStashPartnerships();

  for (const stashPartnership of stashPartnerships) {
    const destinationsId = stashPartnership.id.replace(
      "partnership|",
      "destinations|"
    );

    delete stashPartnership.id;
    saveDestinations(destinationsId, stashPartnership);

    // get "sending" profile from Stash
    const sendingStashProfile = findStashProfile(
      stashPartnership.sendingProfileId
    );
    // create "local" profile in Partners API
    const localProfile: CreateX12ProfileCommandInput = {
      profileId: sendingStashProfile.id,
      profileType: "local",
      interchangeQualifier: sendingStashProfile.partnerInterchangeQualifier,
      interchangeId: sendingStashProfile.partnerInterchangeId.padStart(15, " "),
      applicationId: sendingStashProfile.partnerApplicationId,
    };
    await partners.send(new CreateX12ProfileCommand(localProfile));
    migratedStashProfileKeys.push(sendingStashProfile.id);

    // get "receiving" profile from Stash
    const receivingStashProfile = findStashProfile(
      stashPartnership.sendingProfileId
    );
    // create "partner" profile in Partners API
    const partnerProfile: CreateX12ProfileCommandInput = {
      profileId: receivingStashProfile.id,
      profileType: "partner",
      interchangeQualifier: receivingStashProfile.partnerInterchangeQualifier,
      interchangeId: receivingStashProfile.partnerInterchangeId.padStart(
        15,
        " "
      ),
      applicationId: receivingStashProfile.partnerApplicationId,
    };
    await partners.send(new CreateX12ProfileCommand(partnerProfile));
    migratedStashProfileKeys.push(receivingStashProfile.id);

    for (const transactionSet of stashPartnership.transactionSets) {
    }
  }

  // move profiles from stash to Partners API

  /// CLEANUP AFTER ALL SUCCESSFUL MIGRATION

  // delete partnerships from Stash
  for (const stashPartnership of stashPartnerships) {
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: stashPartnership.id,
      })
    );
  }

  // delete profiles from Stash
  for (const migratedStashProfileKey of migratedStashProfileKeys) {
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: migratedStashProfileKey,
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
    (item) => item.key?.toLowerCase() === `profiles|${id}`
  );

  if (
    profile === undefined ||
    profile.value === undefined ||
    typeof profile.value !== "object"
  )
    throw new Error(`Profile not found or invalid: ${id}`);

  return cloneDeep({ ...profile.value, id: profile.key });
};
