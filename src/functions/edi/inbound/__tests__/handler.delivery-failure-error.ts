import test from "ava";
import nock from "nock";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockPartnersClient,
  mockStashClient,
} from "../../../../lib/testing/testHelpers.js";
import { handler } from "../handler.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { sampleTransactionProcessedEvent } from "../__fixtures__/events.js";
import guideJSON855 from "../__fixtures__/855-guide.json" assert { type: "json" };
import { GetObjectCommand } from "@stedi/sdk-client-buckets";
import { Readable } from "node:stream";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import { destinationExecutionErrorKey } from "../../../../lib/types/Destination.js";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";

const buckets = mockBucketClient();
const partners = mockPartnersClient();
const stash = mockStashClient();

const partnershipId = "this-is-me_another-merchant";

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  partners.reset();
  stash.reset();
});

test("sends execution errors to error destination when runtime error occurs", async (t) => {
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

  stash
    // loading destinations
    .on(GetValueCommand, {
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: destinationExecutionErrorKey,
    })
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

  // mock destination webhook delivery
  const webhookRequest = nock("https://webhook.site")
    .post("/TESTING", (body) => t.deepEqual(body, guideJSON855))
    .reply(500);

  const errorWebhook = nock("https://example.com")
    .post("/error-webhook", (body: any) => {
      return (
        body.error.context.rejected[0].destination.destination.url ===
          "https://webhook.site/TESTING" &&
        body.error.context.rejected[0].payload &&
        body.error.context.rejected[0].error
      );
    })
    .reply(200);

  const response = await handler(sampleTransactionProcessedEvent as any);

  t.not(response.statusCode, 200, "not successful");
  t.assert(webhookRequest.isDone(), "webhook request was made");
  t.assert(errorWebhook.isDone(), "error webhook is called");
});
