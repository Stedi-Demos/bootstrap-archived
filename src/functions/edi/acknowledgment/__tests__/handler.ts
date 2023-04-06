import test from "ava";
import { handler } from "../handler.js";
import nock from "nock";
import { sampleTranslationSucceededEvent } from "../__fixtures__/events.js";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockFunctionsClient,
  mockGuideClient,
  mockStashClient,
} from "../../../../lib/testing/testHelpers.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import {
  InvocationType,
  InvokeFunctionCommand,
} from "@stedi/sdk-client-functions";
import { OutboundEvent } from "../../../../lib/types/OutboundEvent.js";
import { DestinationAck } from "../../../../lib/types/Destination.js";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";

const stash = mockStashClient();
const guides = mockGuideClient();
const functions = mockFunctionsClient();
const buckets = mockBucketClient();

const { partnershipId } = sampleTranslationSucceededEvent.detail.partnership;
const { controlNumber, functionalIdentifierCode, release } =
  sampleTranslationSucceededEvent.detail.envelopes.functionalGroup;
const { usageIndicatorCode } =
  sampleTranslationSucceededEvent.detail.envelopes.interchange;

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  guides.reset();
  stash.reset();
  functions.reset();
  buckets.reset();
});

test.serial(
  `processes incoming functional_group.processed event, generating 997 for configured transaction sets`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `functional_acknowledgments|${partnershipId}`,
      }) // mock destinations lookup
      .resolvesOnce({
        key: `functional_acknowledgments|${partnershipId}`,
        value: {
          generateFor: ["850"],
        } satisfies DestinationAck,
      });

    functions
      .on(InvokeFunctionCommand, {
        functionName: "edi-outbound",
        invocationType: InvocationType.ASYNCHRONOUS,
      })
      .resolvesOnce({});

    await handler(sampleTranslationSucceededEvent);

    t.is(functions.commandCalls(InvokeFunctionCommand).length, 1);
    const { payload, metadata } = functions.commandCalls(
      InvokeFunctionCommand
    )[0]!.args[0].input.payload as OutboundEvent;
    t.deepEqual(payload, {
      heading: {
        functional_group_response_header_AK1: {
          functional_identifier_code_01: functionalIdentifierCode,
          group_control_number_02: controlNumber,
        },
        functional_group_response_trailer_AK9: {
          functional_group_acknowledge_code_01: "A",
          number_of_accepted_transaction_sets_04: 1,
          number_of_received_transaction_sets_03: 1,
          number_of_transaction_sets_included_02: 1,
        },
        transaction_set_header_ST: {
          transaction_set_control_number_02: 1,
          transaction_set_identifier_code_01: "997",
        },
      },
    });

    t.deepEqual(metadata, {
      transactionSet: "997",
      release,
      useBuiltInGuide: true,
      partnershipId,
      usageIndicatorCode,
    });
  }
);

test.serial(
  `processes incoming functional_group.processed event, truncating release longer than 6 chars before generating 997`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `functional_acknowledgments|${partnershipId}`,
      }) // mock destinations lookup
      .resolvesOnce({
        key: `functional_acknowledgments|${partnershipId}`,
        value: {
          generateFor: ["850"],
        } satisfies DestinationAck,
      });

    functions
      .on(InvokeFunctionCommand, {
        functionName: "edi-outbound",
        invocationType: InvocationType.ASYNCHRONOUS,
      })
      .resolvesOnce({});

    const event = sampleTranslationSucceededEvent;
    event.detail.envelopes.functionalGroup.release = "004010VICS";
    await handler(event);

    t.is(functions.commandCalls(InvokeFunctionCommand).length, 1);
    const { payload, metadata } = functions.commandCalls(
      InvokeFunctionCommand
    )[0]!.args[0].input.payload as OutboundEvent;
    t.deepEqual(payload, {
      heading: {
        functional_group_response_header_AK1: {
          functional_identifier_code_01: functionalIdentifierCode,
          group_control_number_02: controlNumber,
        },
        functional_group_response_trailer_AK9: {
          functional_group_acknowledge_code_01: "A",
          number_of_accepted_transaction_sets_04: 1,
          number_of_received_transaction_sets_03: 1,
          number_of_transaction_sets_included_02: 1,
        },
        transaction_set_header_ST: {
          transaction_set_control_number_02: 1,
          transaction_set_identifier_code_01: "997",
        },
      },
    });

    t.deepEqual(metadata, {
      transactionSet: "997",
      release: "004010",
      useBuiltInGuide: true,
      partnershipId,
      usageIndicatorCode,
    });
  }
);

test.serial(
  `processes incoming functional_group.processed event, skips generating 997 when no configuration is set`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        key: `functional_acknowledgments|${partnershipId}`,
      }) // mock destinations lookup
      .resolvesOnce({});

    functions
      .on(InvokeFunctionCommand, {
        functionName: "outbound",
        invocationType: InvocationType.ASYNCHRONOUS,
      })
      .resolvesOnce({});

    await handler(sampleTranslationSucceededEvent);

    t.is(functions.commandCalls(InvokeFunctionCommand).length, 0);
  }
);

test.serial(
  `processes incoming functional_group.processed event, skips generating 997 when not configured for transaction set`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        key: `functional_acknowledgments|${partnershipId}`,
      }) // mock destinations lookup
      .resolvesOnce({
        key: `functional_acknowledgments|${partnershipId}`,
        value: {
          generateFor: ["810"],
        } satisfies DestinationAck,
      });

    functions
      .on(InvokeFunctionCommand, {
        functionName: "outbound",
        invocationType: InvocationType.ASYNCHRONOUS,
      })
      .resolvesOnce({});

    await handler(sampleTranslationSucceededEvent);

    t.is(functions.commandCalls(InvokeFunctionCommand).length, 0);
  }
);
