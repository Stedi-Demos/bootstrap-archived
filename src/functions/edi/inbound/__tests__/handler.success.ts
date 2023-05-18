import test from "ava";
import { handler } from "../handler.js";
import nock from "nock";
import { sampleTransactionProcessedEvent } from "../__fixtures__/events.js";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockGuideClient,
  mockStashClient,
  mockTranslateClient,
} from "../../../../lib/testing/testHelpers.js";
import { GetObjectCommand, PutObjectCommand } from "@stedi/sdk-client-buckets";
import { Readable } from "stream";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import guideJSON855 from "../__fixtures__/855-guide.json" assert { type: "json" };
import { TransactionSetDestinations } from "../../../../lib/types/Destination.js";
import { edi855 } from "../__fixtures__/855-edi.js";

const buckets = mockBucketClient();
const translate = mockTranslateClient();
const stash = mockStashClient();
const guides = mockGuideClient();

const partnershipId = "this-is-me_another-merchant";

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  guides.reset();
  stash.reset();
  translate.reset();
});

test.serial(
  `processes incoming transaction.processed event, delivering to destination`,
  async (t) => {
    // loading incoming EDI file from S3
    buckets.on(GetObjectCommand, {}).resolves({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode(JSON.stringify(guideJSON855))])
      ),
    });

    stash
      .on(GetValueCommand, {
        key: `destinations|${partnershipId}|855`,
      }) // mock destinations lookup
      .resolvesOnce({
        value: {
          description:
            "Purchase Order Acknowledgments received from ANOTHERMERCH",
          destinations: [
            {
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING",
                verb: "POST",
              },
            },
            {
              destination: {
                type: "bucket",
                bucketName: "another-merchant-edi",
                path: "inbound/855",
              },
            },
          ],
        },
      });

    // mock destination webhook delivery
    const webhookRequest = nock("https://webhook.site")
      .post("/TESTING", (body) => t.deepEqual(body, guideJSON855))
      .reply(200, { thank: "you" });

    const result = await handler(sampleTransactionProcessedEvent);

    t.assert(
      webhookRequest.isDone(),
      "delivered guide JSON to destination webhook"
    );

    const bucketDestinationCall = buckets.commandCalls(PutObjectCommand, {
      bucketName: "another-merchant-edi",
    });

    t.is(bucketDestinationCall.length, 1, "delivered guide JSON to bucket");
    t.is(
      bucketDestinationCall[0]!.args[0].input.key,
      "inbound/855/1746-1746-1-855.json",
      "sets filename prefix to control numbers"
    );

    t.deepEqual(result, {});
  }
);

test.serial.only(
  `delivers to webhook destination with edi when includeSource is set`,
  async (t) => {
    // loading incoming EDI file from S3
    buckets
      .on(GetObjectCommand, {
        key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.json",
      })
      .resolves({
        body: sdkStreamMixin(
          Readable.from([
            new TextEncoder().encode(JSON.stringify(guideJSON855)),
          ])
        ),
      });

    buckets
      .on(GetObjectCommand, {
        key: "1f1b129a-9b86-04ea-3815-2d0f2b271c19/1746-1746-1.edi",
      })
      .resolves({
        body: sdkStreamMixin(Readable.from([new TextEncoder().encode(edi855)])),
      });

    stash
      .on(GetValueCommand, {
        key: `destinations|${partnershipId}|855`,
      }) // mock destinations lookup
      .resolvesOnce({
        value: {
          description:
            "Purchase Order Acknowledgments received from ANOTHERMERCH",
          destinations: [
            {
              description: "include source webhook",
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING",
                verb: "POST",
                includeSource: true,
              },
            },
            {
              destination: {
                type: "bucket",
                bucketName: "another-merchant-edi",
                path: "inbound/855",
              },
            },
          ],
        } satisfies TransactionSetDestinations,
      });

    // mock destination webhook delivery
    const webhookRequest = nock("https://webhook.site")
      .post("/TESTING", (body) =>
        t.deepEqual(body, { ...guideJSON855, source: edi855 })
      )
      .reply(200, { thank: "you" });

    const result = await handler(sampleTransactionProcessedEvent);

    t.assert(
      webhookRequest.isDone(),
      "delivered guide JSON to destination webhook"
    );

    const bucketDestinationCall = buckets.commandCalls(PutObjectCommand, {
      bucketName: "another-merchant-edi",
    });

    t.is(bucketDestinationCall.length, 1, "delivered guide JSON to bucket");
    t.is(
      bucketDestinationCall[0]!.args[0].input.key,
      "inbound/855/1746-1746-1-855.json",
      "sets filename prefix to control numbers"
    );

    t.deepEqual(result, {});
  }
);
