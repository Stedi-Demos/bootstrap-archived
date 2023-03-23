import test from "ava";
import nock from "nock";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockGuideClient,
  mockStashClient,
  mockTranslateClient,
} from "../../../../lib/testing/testHelpers.js";
import { handler } from "../handler.js";
import {
  GetValueCommand,
  IncrementValueCommand,
} from "@stedi/sdk-client-stash";
import { GetObjectCommand } from "@stedi/sdk-client-buckets";
import { Readable } from "node:stream";
import { destinationExecutionErrorKey } from "../../../../lib/types/Destination.js";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import fs from "node:fs";
import { sampleS3Event } from "../__fixtures__/events.js";
import { TranslateX12ToJsonCommand } from "@stedi/sdk-client-edi-translate";
import { GetGuideCommand } from "@stedi/sdk-client-guides";
import assert from "node:assert";

const sample855 = fs.readFileSync(
  "./src/resources/X12/5010/855/inbound.edi",
  "utf8"
);

const buckets = mockBucketClient();
const stash = mockStashClient();
const translate = mockTranslateClient();
const guides = mockGuideClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  stash.reset();
  stash.reset();
  translate.reset();
});

test("sends execution errors to error destination when runtime error occurs", async (t) => {
  // loading incoming EDI file from S3
  buckets.on(GetObjectCommand, {}).resolves({
    body: sdkStreamMixin(Readable.from([new TextEncoder().encode(sample855)])),
  });

  // mock translate response
  translate.on(TranslateX12ToJsonCommand).resolvesOnce({
    output: {
      transactionSets: [{}],
      envelope: { controlNumber: "123456" },
    },
  });

  stash
    .on(GetValueCommand, { key: "lookup|ISA|14/ANOTHERMERCH" }) // mock sending partner lookup
    .resolvesOnce({ value: { partnerId: "another-merchant" } })
    .on(GetValueCommand, { key: "lookup|ISA|ZZ/THISISME" }) // mock receiving partner lookup
    .resolvesOnce({ value: { partnerId: "this-is-me" } })
    .on(GetValueCommand, { key: "partnership|another-merchant|this-is-me" }) // mock partnership lookup
    .resolvesOnce({
      value: {
        transactionSets: [
          {
            acknowledgmentConfig: {
              acknowledgmentType: "997",
            },
            description:
              "Purchase Order Acknowledgements received from ANOTHERMERCH",
            destinations: [
              {
                destination: {
                  type: "webhook",
                  url: "https://webhook.site/TESTING",
                  verb: "POST",
                },
              },
            ],
            guideId: "01GRRSB3TXW9Z4J2J75Z9RPR3S",
            receivingPartnerId: "this-is-me",
            sendingPartnerId: "another-merchant",
            usageIndicatorCode: "T",
          },
          {
            description: "Outbound 997 Acknowledgments",
            destinations: [
              {
                destination: {
                  bucketName: "test-ftp-bucket",
                  path: "trading_partners/ANOTHERMERCH/outbound",
                  type: "bucket",
                },
              },
            ],
            transactionSetIdentifier: "997",
            usageIndicatorCode: "T",
          },
        ],
      },
    })
    .on(IncrementValueCommand, { key: "T|ISA|this-is-me|another-merchant" }) // 997 control number generation ISA
    .resolves({ value: 9 })
    .on(IncrementValueCommand, { key: "T|GS|this-is-me|another-merchant" }) // 997 control number generation GS
    .resolves({ value: 9 })
    .on(GetValueCommand, { key: destinationExecutionErrorKey })
    .resolvesOnce({
      value: {
        description: "execution errors",
        destinations: [
          {
            destination: {
              type: "webhook",
              url: "https://example.com/error-webhook",
            },
          },
        ],
      },
    });

  // mock guide retrieval
  guides.on(GetGuideCommand).resolvesOnce({
    id: "LIVE_01GRRSB3TXW9Z4J2J75Z9RPR3S",
    target: { standard: "x12", release: "005010", transactionSet: "855" },
  });

  // mock destination webhook delivery
  const webhookRequest = nock("https://webhook.site")
    .post("/TESTING")
    .reply(500);

  const errorWebhook = nock("https://example.com")
    .post("/error-webhook", (body: any) => {
      return (
        body.error.context.processingErrors[0].error.context.rejected[0]
          .destination.destination.url === "https://webhook.site/TESTING"
      );
    })
    .reply(200);

  const key = `trading_partners/ANOTHERMERCH/inbound/inbound.edi`;
  const response = await handler(sampleS3Event(key));

  assert("statusCode" in response);
  t.not(response.statusCode, 200, "not successful");
  t.assert(webhookRequest.isDone(), "webhook request was made");
  t.assert(errorWebhook.isDone(), "error webhook is called");
});
