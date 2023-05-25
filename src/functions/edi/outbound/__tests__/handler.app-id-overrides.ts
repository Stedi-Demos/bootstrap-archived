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
  Timezone,
} from "@stedi/sdk-client-partners";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import { TransactionSetDestinations } from "../../../../lib/types/Destination.js";
import {
  TranslateJsonToX12Command,
  TranslateJsonToX12Output,
} from "@stedi/sdk-client-edi-translate";
import { reset, set } from "mockdate";

const buckets = mockBucketClient();
const partners = mockPartnersClient();
const stash = mockStashClient();
const translate = mockTranslateClient();

const guideId = "850-guide-id";
const partnershipId = "this-is-me_another-merchant";

test.beforeEach(() => {
  nock.disableNetConnect();
  set("2022-05-25T01:02:03.451Z");
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  partners.reset();
  stash.reset();
  translate.reset();
  reset();
});

test.serial(
  "uses application id overrides from outbound transaction setting when present",
  async (t) => {
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
          applicationIdentifiers: [
            {
              value: "meId",
              isDefault: true,
            },
          ],
        },
        partnerProfileId: "another-merchant",
        partnerProfile: {
          interchangeQualifier: "14",
          interchangeId: "ANOTHERMERCH",
          profileId: "another-merchant",
          profileType: "partner",
          applicationIdentifiers: [
            {
              value: "merchId",
              isDefault: true,
            },
          ],
        },
        outboundTransactions: [
          {
            transactionSetIdentifier: "850",
            outboundX12TransactionSettingsId: "850-transaction-rule-id",
            guideId,
            release: "008010",
            createdAt: new Date(),
            updatedAt: new Date(),
            localApplicationId: "override-meId",
            partnerApplicationId: "override-merchId",
          },
        ],
        inboundTransactions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        timezone: Timezone.AMERICA_NEW_YORK,
        interchangeUsageIndicator: "T",
      } satisfies GetX12PartnershipOutput as any)
      // increment interchange control number
      .on(IncrementX12ControlNumberCommand as any, {
        controlNumberType: "interchange",
      })
      .resolvesOnce({
        x12ControlNumber: 1916,
        controlNumberType: "interchange",
      } satisfies IncrementX12ControlNumberOutput as any)
      // increment group control number
      .on(IncrementX12ControlNumberCommand as any, {
        controlNumberType: "group",
      })
      .resolvesOnce({
        x12ControlNumber: 1916,
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
        applicationIdentifiers: [
          {
            value: "meId",
            isDefault: true,
          },
        ],
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
        applicationIdentifiers: [
          {
            value: "merchId",
            isDefault: true,
          },
        ],
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
              direction: "outbound",
              destination: {
                type: "webhook",
                url: "https://example.com/webhook",
              },
            },
          ],
        } satisfies TransactionSetDestinations,
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (translateArgs.envelope as any).groupHeader.applicationReceiverCode,
      "override-merchId",
      "override applicationId from transaction setting is used for receiver"
    );

    t.is(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      (translateArgs.envelope as any).groupHeader.applicationSenderCode,
      "override-meId",
      "override applicationId from transaction setting is used for sender"
    );

    t.is(
      (translateArgs.envelope as any).interchangeHeader.date,
      "2022-05-24",
      "date is set in partner configured timezone"
    );

    t.is(
      (translateArgs.envelope as any).interchangeHeader.time,
      "21:02",
      "time is set in partner configured timezone"
    );

    t.is(
      (translateArgs.envelope as any).groupHeader.date,
      "2022-05-24",
      "date is set in partner configured timezone"
    );

    t.is(
      (translateArgs.envelope as any).groupHeader.time,
      "21:02:03",
      "time is set in partner configured timezone"
    );
  }
);
