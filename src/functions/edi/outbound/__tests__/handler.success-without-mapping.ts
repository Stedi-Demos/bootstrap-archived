import test from "ava";
import nock from "nock";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockPartnersClient,
  mockStashClient,
  mockTranslateClient,
} from "../../../../lib/testing/testHelpers.js";
import { handler } from "../handler.js";
import sampleOutboundEvent from "../../../../resources/X12/5010/850/outbound.json" assert { type: "json" };
import { GetX12PartnershipCommand } from "@stedi/sdk-client-partners";
import {
  GetValueCommand,
  IncrementValueCommand,
} from "@stedi/sdk-client-stash";
import {
  OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
  PARTNERS_KEYSPACE_NAME,
} from "../../../../lib/constants.js";
import { TranslateJsonToX12Command } from "@stedi/sdk-client-edi-translate";

const buckets = mockBucketClient();
const partners = mockPartnersClient();
const stash = mockStashClient();
const translate = mockTranslateClient();

const transactionId = "850-transaction-rule-id";
const guideId = "850-guide-id";

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  partners.reset();
  stash.reset();
  translate.reset();
});

test("translate guide json to X12 and delivers to destination", async (t) => {
  partners
    // load partnership
    .on(GetX12PartnershipCommand as any, {
      partnershipId: "this-is-me_another-merchant",
    })
    .resolvesOnce({
      partnershipId: "this-is-me_another-merchant",
      localProfileId: "this-is-me",
      localProfile: { interchangeQualifier: "ZZ", interchangeId: "THISISME" },
      partnerProfileId: "another-merchant",
      partnerProfile: {
        interchangeQualifier: "14",
        interchangeId: "ANOTHERMERCH",
      },
      outboundTransactions: [
        {
          transactionSetIdentifier: "850",
          transactionId,
          guideId,
        },
      ],
    } as any);

  stash
    // loading destinations
    .on(GetValueCommand, {
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `destinations|${transactionId}`,
    })
    .resolvesOnce({
      value: {
        description: "850 Outbound",
        destinations: [
          {
            destination: {
              type: "webhook",
              url: "https://example.com/webhook",
            },
          },
        ],
      },
    })
    // generate isa control number
    .on(IncrementValueCommand, {
      key: "T|ISA|this-is-me|another-merchant",
      keyspaceName: OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    })
    .resolvesOnce({ value: 1916 })
    // generate gs control number
    .on(IncrementValueCommand, {
      key: "T|GS|this-is-me|another-merchant",
      keyspaceName: OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    })
    .resolvesOnce({ value: 1916 });

  translate
    // convert guide JSON to x12
    .on(TranslateJsonToX12Command)
    .resolvesOnce({ output: "ISA*" });

  // mock webhook request
  const webhookRequest = nock("https://example.com")
    .post("/webhook")
    .reply(200, { ok: true });

  await handler(sampleOutboundEvent as any);

  t.assert(webhookRequest.isDone(), "webhook request was made");
});
