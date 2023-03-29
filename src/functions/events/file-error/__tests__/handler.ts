import test from "ava";
import { handler } from "../handler.js";
import nock from "nock";
import { sampleFileErrorEvent } from "../__fixtures__/events.js";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockFunctionsClient,
  mockMappingsClient,
  mockStashClient,
} from "../../../../lib/testing/testHelpers.js";
import { GetValueCommand, SetValueCommand } from "@stedi/sdk-client-stash";
import {
  InvocationType,
  InvokeFunctionCommand,
} from "@stedi/sdk-client-functions";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import {
  destinationFileErrorEventsKey,
  DestinationErrorEvents,
} from "../../../../lib/types/Destination.js";
import { MapDocumentCommand } from "@stedi/sdk-client-mappings";

const stash = mockStashClient();
const functions = mockFunctionsClient();
const buckets = mockBucketClient();
const mappings = mockMappingsClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  stash.reset();
  functions.reset();
  buckets.reset();
  mappings.reset();
});

test.serial(
  `processes incoming engine file.failed event, sending event to configured destinations`,
  async (t) => {
    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationFileErrorEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationFileErrorEventsKey,
        value: {
          description: "destinations to handle file events",
          destinations: [
            {
              destination: {
                type: "function",
                functionName: "a-function",
                additionalInput: { extraKey: "extraValue" },
              },
            },
            {
              destination: {
                type: "stash",
                keyspaceName: "a-keyspace",
                keyPrefix: "a-prefix",
              },
            },
            {
              mappingId: "a-mapping",
              destination: {
                type: "webhook",
                url: "https://example.com/a-webhook",
                verb: "POST",
              },
            },
          ],
        } satisfies DestinationErrorEvents,
      });

    functions
      .on(InvokeFunctionCommand, {
        functionName: "a-function",
        invocationType: InvocationType.ASYNCHRONOUS,
      })
      .resolvesOnce({});

    stash
      .on(SetValueCommand, {
        keyspaceName: "a-keyspace",
      })
      .resolvesOnce({});

    mappings
      .on(MapDocumentCommand, {
        id: "a-mapping",
      })
      .resolvesOnce({ content: { mapped: true } });

    const webhookRequest = nock("https://example.com")
      .post("/a-webhook", (body: any) => {
        if (body.mapped === true) {
          return true;
        }
        return false;
      })
      .reply(200, { ok: true });

    await handler(sampleFileErrorEvent);

    t.is(functions.commandCalls(InvokeFunctionCommand).length, 1);
    const { payload } = functions.commandCalls(InvokeFunctionCommand)[0]!
      .args[0].input;
    t.deepEqual(payload, { ...sampleFileErrorEvent, extraKey: "extraValue" });

    t.assert(webhookRequest.isDone());

    t.is(
      stash.commandCalls(SetValueCommand, {
        keyspaceName: "a-keyspace",
      }).length,
      1
    );
    const { key, value } = stash.commandCalls(SetValueCommand, {
      keyspaceName: "a-keyspace",
    })[0]!.args[0].input;

    t.assert(key?.includes("a-prefix"));
    t.assert(key?.includes(sampleFileErrorEvent.detail.fileId));
    t.deepEqual(value, sampleFileErrorEvent);

    t.is(
      mappings.commandCalls(MapDocumentCommand, {
        id: "a-mapping",
      }).length,
      1
    );
  }
);
