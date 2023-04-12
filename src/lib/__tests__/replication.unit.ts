import test from "ava";
import fs from "node:fs";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { mockBucketClient, mockStashClient } from "../testing/testHelpers.js";
import { processReplication } from "../replication.js";

const buckets = mockBucketClient();
const stash = mockStashClient();

const sample855 = fs.readFileSync(
  "./src/resources/X12/5010/855/inbound.edi",
  "utf8"
);

test.afterEach.always(() => {
  buckets.reset();
  stash.reset();
});

test.serial("replicates input to destination", async (t) => {
  stash
    .on(GetValueCommand, { key: "bootstrap|replication-config" })
    .resolvesOnce({
      value: {
        destinations: [
          {
            destination: {
              bucketName: "core-ingestion-bucket",
              path: "replicated-documents",
              type: "bucket",
            },
          },
        ],
      },
    });

  await processReplication({
    currentKey: "trading_partners/ANOTHERMERCH/inbound/inbound.edi",
    body: sample855,
  });

  t.like(buckets.calls()[0].args[0].input, {
    bucketName: "core-ingestion-bucket",
    key: "replicated-documents/inbound.edi",
  });
});

test.serial("is a no-op if configuration does not exist", async (t) => {
  stash
    .on(GetValueCommand, { key: "bootstrap|replication-config" })
    .resolvesOnce({
      value: undefined,
    });

  await processReplication({
    currentKey: "trading_partners/ANOTHERMERCH/inbound/inbound.edi",
    body: sample855,
  });

  t.assert(buckets.calls().length === 0);
});
