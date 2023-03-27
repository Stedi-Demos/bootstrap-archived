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
  GetX12PartnershipOutput,
  GetX12ProfileCommand,
  GetX12ProfileOutput,
  IncrementX12ControlNumberCommand,
  IncrementX12ControlNumberOutput,
} from "@stedi/sdk-client-partners";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import {
  TranslateJsonToX12Command,
  TranslateJsonToX12Output,
} from "@stedi/sdk-client-edi-translate";

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
      localProfile: {
        interchangeQualifier: "ZZ",
        interchangeId: "THISISME",
        profileId: "this-is-me",
        profileType: "local",
      },
      partnerProfileId: "another-merchant",
      partnerProfile: {
        interchangeQualifier: "14",
        interchangeId: "ANOTHERMERCH",
        profileId: "another-merchant",
        profileType: "partner",
      },
      outboundTransactions: [
        {
          transactionSetIdentifier: "850",
          transactionId: "850-transaction-rule-id",
          guideId,
          release: "008010",
          createdAt: new Date(),
          updatedAt: new Date(),
          timeZone: "Americas/New_York",
        },
      ],
      inboundTransactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies GetX12PartnershipOutput as any)
    // increment interchange control number
    .on(IncrementX12ControlNumberCommand as any, {
      controlNumberType: "interchange",
    })
    .resolvesOnce({
      x12ControlNumber: 1916,
    } satisfies IncrementX12ControlNumberOutput as any)
    // increment group control number
    .on(IncrementX12ControlNumberCommand as any, {
      controlNumberType: "group",
    })
    .resolvesOnce({
      x12ControlNumber: 1916,
    } satisfies IncrementX12ControlNumberOutput as any)
    .on(GetX12ProfileCommand as any, {
      profileId: "this-is-me",
    })
    .resolvesOnce({
      interchangeQualifier: "ZZ",
      interchangeId: "THISISME",
      profileId: "this-is-me",
      profileType: "local",
      defaultApplicationId: "meId",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies GetX12ProfileOutput as any)
    .on(GetX12ProfileCommand as any, {
      profileId: "another-merchant",
    })
    .resolvesOnce({
      interchangeQualifier: "14",
      interchangeId: "ANOTHERMERCH",
      profileId: "another-merchant",
      profileType: "partner",
      defaultApplicationId: "merchId",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies GetX12ProfileOutput as any);

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
    .resolvesOnce({ output: "ISA*" } satisfies TranslateJsonToX12Output);

  // mock webhook request
  const webhookRequest = nock("https://example.com")
    .post("/webhook")
    .reply(200, { ok: true });

  const response = await handler(sampleOutboundEvent as any);

  t.is(response.statusCode, 200, "completes successfully");

  t.assert(webhookRequest.isDone(), "webhook request was made");

  const translateArgs = translate.commandCalls(TranslateJsonToX12Command)[0]!
    .args[0].input;
  t.is(
    (translateArgs.envelope as any)!.groupHeader.applicationReceiverCode,
    "merchId",
    "default applicationId is used for receiver"
  );

  t.is(
    (translateArgs.envelope as any)!.groupHeader.applicationSenderCode,
    "meId",
    "default applicationId is used for sender"
  );
});
