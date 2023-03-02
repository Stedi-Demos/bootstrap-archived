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
  // create  Destinations from Partnerships
  const stashPartnerships = await allStashPartnerships();

  for (const stashPartnership of stashPartnerships) {
    const destinationsId = stashPartnership.id.replace(
      "partnership|",
      "destinations|"
    );

    delete stashPartnership.id;

    saveDestinations(destinationsId, stashPartnership);
  }

  // move profiles from stash to Partners API
  const stashProfiles = await allStashProfiles();
  for (const stashProfile of stashProfiles) {
    const profile: CreateX12ProfileCommandInput = {
      profileId: stashProfile.id,
      profileType: "partner",
      interchangeQualifier: stashProfile.partnerInterchangeQualifier,
      interchangeId: stashProfile.partnerInterchangeId.padStart(15, " "),
      applicationId: stashProfile.partnerApplicationId,
    };

    await partners.send(new CreateX12ProfileCommand(profile));
  }

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
  for (const stashProfile of stashProfiles) {
    await stash.send(
      new DeleteValueCommand({
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: stashProfile.id,
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

const allStashPartnerships = async (): Promise<any[]> => {
  return allConfigValues
    .filter((item) => item.key?.toLowerCase().startsWith("partnership|"))
    .map((item) => cloneDeep({ id: item.key, ...(item.value as object) }));
};

const allStashProfiles = async (): Promise<any[]> => {
  return allConfigValues
    .filter((item) => item.key?.toLowerCase().startsWith("profiles|"))
    .map((item) => cloneDeep({ id: item.key, ...(item.value as object) }));
};
