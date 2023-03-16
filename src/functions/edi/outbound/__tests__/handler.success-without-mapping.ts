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
import {
  GetX12PartnershipCommand,
  IncrementX12ControlNumberCommand,
} from "@stedi/sdk-client-partners";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import { TranslateJsonToX12Command } from "@stedi/sdk-client-edi-translate";

const buckets = mockBucketClient();
const partners = mockPartnersClient();
const stash = mockStashClient();
const translate = mockTranslateClient();

const guideId = "850-guide-id";
const partnershipId = "this-is-me_another-merchant";

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
      partnershipId,
    })
    .resolvesOnce({
      partnershipId,
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
          transactionId: "850-transaction-rule-id",
          guideId,
        },
      ],
    } as any)
    // increment interchange control number
    .on(IncrementX12ControlNumberCommand as any, {
      controlNumberType: "interchange",
    })
    .resolvesOnce({ x12ControlNumber: 1916 } as any)
    // increment group control number
    .on(IncrementX12ControlNumberCommand as any, {
      controlNumberType: "group",
    })
    .resolvesOnce({ x12ControlNumber: 1916 } as any);

  stash
    // loading destinations
    .on(GetValueCommand, {
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: `destinations|${partnershipId}|850`,
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
    });

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
