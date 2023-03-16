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
import { GetObjectCommand } from "@stedi/sdk-client-buckets";
import { Readable } from "stream";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import guideJSON855 from "../__fixtures__/855-guide.json" assert { type: "json" };

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

    t.deepEqual(result, {});
  }
);
