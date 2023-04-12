import test from "ava";
import { loadPartnership } from "../loadPartnership.js";
import { mockStashClient } from "../testing/testHelpers.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../constants.js";

const stash = mockStashClient();

test.afterEach.always(() => {
  stash.reset();
});

test.serial(
  "load partnership defaults to utc timezone if no value is set",
  async (t) => {
    stash
      .on(GetValueCommand, { keyspaceName: PARTNERS_KEYSPACE_NAME })
      .resolvesOnce({
        key: "partnership|sender|receiver",
        value: {
          transactionSets: [],
        },
      });

    const partnership = await loadPartnership("sender", "receiver");

    t.is(partnership.timezone, "UTC", "partnership defaults to UTC timezone");
  }
);

test.serial("load partnership uses set timezone", async (t) => {
  stash
    .on(GetValueCommand, { keyspaceName: PARTNERS_KEYSPACE_NAME })
    .resolvesOnce({
      key: "partnership|sender|receiver",
      value: {
        timezone: "America/New_York",
        transactionSets: [],
      },
    });

  const partnership = await loadPartnership("sender", "receiver");

  t.is(
    partnership.timezone,
    "America/New_York",
    "partnership uses set timezone"
  );
});

test.serial(
  "throws on invalid partnership config with helpful message",
  async (t) => {
    stash
      .on(GetValueCommand, { keyspaceName: PARTNERS_KEYSPACE_NAME })
      .resolvesOnce({
        key: "partnership|sender|receiver",
        value: {
          tim: "America/New_York",
          transactionSets: [],
        },
      });

    const error = await loadPartnership("sender", "receiver").catch((e) => e);

    t.is(error.message, "Invalid Partnership configuration");
  }
);
