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
import { InvokeFunctionCommand } from "@stedi/sdk-client-functions";
import {
  DestinationAck,
  DestinationErrorEvents,
} from "../../../../lib/types/Destination.js";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";

const stash = mockStashClient();
const guides = mockGuideClient();
const functions = mockFunctionsClient();
const buckets = mockBucketClient();

const { partnershipId } = sampleTranslationSucceededEvent.detail.partnership;

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
  `processes incoming functional_group.processed event, throws error if stash configuration is incorrect`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `functional_acknowledgments|${partnershipId}`,
      }) // mock destinations lookup
      .resolvesOnce({
        key: `functional_acknowledgments|${partnershipId}`,
        value: {
          invalidValue: ["850"],
        } as any as DestinationAck,
      });

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: `destinations|errors|execution`,
      })
      .resolvesOnce({
        key: `destinations|errors|execution`,
        value: {
          destinations: [
            {
              destination: {
                type: "function",
                functionName: "exception-function",
              },
            },
          ],
        } satisfies DestinationErrorEvents,
      });

    functions
      .on(InvokeFunctionCommand, {
        functionName: "exception-function",
      })
      .resolvesOnce({});

    const error = await handler(sampleTranslationSucceededEvent).catch(
      (e) => e
    );

    const exceptionFunctionCall = functions.commandCalls(
      InvokeFunctionCommand,
      {
        functionName: "exception-function",
      }
    )[0]!;

    t.truthy(exceptionFunctionCall);

    const { payload: exceptionPayload } = exceptionFunctionCall.args[0].input;
    t.is((exceptionPayload as any).error.name, "StashConfigurationError");
    t.is((exceptionPayload as any).error.context.details.length, 2);
    t.is(error.name, "StashConfigurationError");
    t.is(error.context.details.length, 2);
  }
);
