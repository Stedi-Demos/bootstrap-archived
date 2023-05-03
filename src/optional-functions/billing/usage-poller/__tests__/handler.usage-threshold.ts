import { GetValueCommand } from "@stedi/sdk-client-stash";
import test from "ava";
import { reset, set } from "mockdate";
import nock from "nock";
import { z } from "zod";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import { mockStashClient } from "../../../../lib/testing/testHelpers.js";
import { ConfigurationSchema } from "../Configuration.js";
import { configurationKey } from "../constants.js";
import { handler } from "../handler.js";

const stash = mockStashClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  set("2022-05-20T01:02:03.451Z");
});

test.afterEach.always(() => {
  stash.reset();
  reset();
});

test.serial(
  `sends message to destination when expected usage threshold is exceeded`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: configurationKey,
      }) // mock destinations lookup
      .resolvesOnce({
        value: {
          destinations: [
            {
              threshold: 500,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING",
                verb: "POST",
              },
            },
            {
              threshold: 1_500,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING_2",
                verb: "POST",
              },
            },
          ],
        } satisfies z.input<typeof ConfigurationSchema>,
      });

    // mock destination webhook delivery
    const webhookRequest = nock("https://webhook.site")
      .post("/TESTING", (body) => {
        return (
          body.threshold === 500 &&
          // use range to account for developer machine timezone differences
          body.estimatedUsage > 557 &&
          body.estimatedUsage < 576
        );
      })
      .once()
      .reply(200, {});

    const billingRequest = nock("https://api.billing.stedi.com")
      .get(/\/2021-09-01\/usage/)
      .once()
      .reply(200, { subtotal: 350 });

    const _result = await handler();

    t.assert(billingRequest.isDone(), "fetched billing usage");
    t.assert(
      webhookRequest.isDone(),
      "delivered guide JSON to destination webhook"
    );
  }
);

test.serial(
  `only sends message to destination with the highest breached threshold`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: configurationKey,
      }) // mock destinations lookup
      .resolvesOnce({
        value: {
          destinations: [
            {
              threshold: 2_000,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING_2",
                verb: "POST",
              },
            },
            {
              threshold: 500,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING",
                verb: "POST",
              },
            },
            {
              threshold: 200,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING_2",
                verb: "POST",
              },
            },
          ],
        } satisfies z.input<typeof ConfigurationSchema>,
      });

    // mock destination webhook delivery
    const webhookRequest = nock("https://webhook.site")
      .post("/TESTING", (body) => {
        return (
          body.threshold === 500 &&
          // use range to account for developer machine timezone differences
          body.estimatedUsage > 557 &&
          body.estimatedUsage < 576
        );
      })
      .once()
      .reply(200, {});

    const billingRequest = nock("https://api.billing.stedi.com")
      .get(/\/2021-09-01\/usage/)
      .once()
      .reply(200, { subtotal: 350 });

    const _result = await handler();

    t.assert(billingRequest.isDone(), "fetched billing usage");
    t.assert(
      webhookRequest.isDone(),
      "delivered guide JSON to destination webhook"
    );
  }
);

test.serial(
  `does not send message when no threshold is breached`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: configurationKey,
      }) // mock destinations lookup
      .resolvesOnce({
        value: {
          destinations: [
            {
              threshold: 2_000,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING_2",
                verb: "POST",
              },
            },
            {
              threshold: 5_000,
              destination: {
                type: "webhook",
                url: "https://webhook.site/TESTING_2",
                verb: "POST",
              },
            },
          ],
        } satisfies z.input<typeof ConfigurationSchema>,
      });

    const billingRequest = nock("https://api.billing.stedi.com")
      .get(/\/2021-09-01\/usage/)
      .once()
      .reply(200, { subtotal: 350 });

    const result = await handler();

    t.assert(billingRequest.isDone(), "fetched billing usage");
    t.assert(!result);
  }
);
