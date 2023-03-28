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
import sampleOutboundEvent from "../__fixtures__/guideless-997.js";
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

test("translate 997 guide json without a guide and delivers to destination", async (t) => {
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
          transactionSetIdentifier: "997",
          transactionId: "997-transaction-rule-id",
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
      x12ControlNumber: 1167,
      controlNumberType: "interchange",
    } satisfies IncrementX12ControlNumberOutput as any)
    // increment group control number
    .on(IncrementX12ControlNumberCommand as any, {
      controlNumberType: "group",
    })
    .resolvesOnce({
      x12ControlNumber: 1167,
      controlNumberType: "group",
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
      key: `destinations|${partnershipId}|997`,
    })
    .resolvesOnce({
      value: {
        description: "997 Outbound",
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
    .post("/webhook", (body: string) => {
      // assert on elements other than date and time
      t.assert(
        body.includes(
          "ISA*00*          *00*          *ZZ*THISISME       *14*ANOTHERMERCH   *"
        ) &&
          body.includes("*^*00801*1167*0*I*>~GS*FA*meId*merchId*") &&
          body.includes(
            "*1167*X*008010~ST*997*0001~AK1*PO*1921~AK9*A*1*1*1~SE*4*0001~GE*1*1167~IEA*1*1167~"
          ),
        "EDI message is valid"
      );
      return true;
    })
    .reply(200, { ok: true });

  const response = await handler(sampleOutboundEvent as any);

  t.is(response.statusCode, 200, "completes successfully");

  t.assert(webhookRequest.isDone(), "webhook request was made");
});
