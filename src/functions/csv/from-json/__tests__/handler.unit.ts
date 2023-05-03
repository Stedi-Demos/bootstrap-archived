import test from "ava";
import z from "zod";
import { handler } from "../handler.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import {
  DestinationCsvFromJsonEvents,
  destinationCsvFromJsonEventsKey,
  DestinationCsvFromJsonEventsSchema,
} from "../../../../lib/types/Destination.js";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockStashClient,
} from "../../../../lib/testing/testHelpers.js";
import nock from "nock";
import {
  inputBaseFilename,
  inputBucketName,
  sampleFileProcessedEvent,
} from "../__fixtures__/events.js";
import { GetObjectCommand, PutObjectCommand } from "@stedi/sdk-client-buckets";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { Readable } from "node:stream";
import { defaultInputAsString } from "../__fixtures__/inputs.js";
import {
  customParserConfigOutput,
  defaultOutput,
} from "../__fixtures__/outputs.js";
import { ErrorWithContext } from "../../../../lib/errorWithContext.js";

const buckets = mockBucketClient();
const stash = mockStashClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  stash.reset();
});

test.serial(
  "processes incoming core file.processed event, converts json to csv, and sends to configured destination",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: DestinationCsvFromJsonEvents = {
      description: "destinations to handle file.processed json events",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName,
            path,
          },
        },
      ],
    };

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvFromJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode(defaultInputAsString)])
      ),
    });

    await handler(sampleFileProcessedEvent);

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.deepEqual(bucketDestinationCalls[0]!.args[0].input, {
      bucketName,
      key: `${path}/${inputBaseFilename}.csv`,
      body: defaultOutput,
    });
  }
);

test.serial(
  "processes incoming core file.processed event and converts json to csv using custom parser config if specified",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: z.input<typeof DestinationCsvFromJsonEventsSchema> = {
      description: "destinations to handle file.processed json events",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName,
            path,
          },
          parserConfig: {
            header: false,
            delimiter: "--",
            newline: "~",
          },
        },
      ],
    };

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvFromJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode(defaultInputAsString)])
      ),
    });

    await handler(sampleFileProcessedEvent);

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.deepEqual(bucketDestinationCalls[0]!.args[0].input, {
      bucketName,
      key: `${path}/${inputBaseFilename}.csv`,
      body: customParserConfigOutput,
    });
  }
);

test.serial(
  "is an no-op for file.processed events when no configured destinations exist",
  async (t) => {
    const bucketName = "testBucket";
    const configValue = undefined;

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvFromJsonEventsKey,
        value: configValue,
      });

    await handler(sampleFileProcessedEvent);

    const bucketGetInputCalls = buckets.commandCalls(GetObjectCommand, {
      bucketName: inputBucketName,
    });

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.is(bucketGetInputCalls.length, 0);
    t.is(bucketDestinationCalls.length, 0);
  }
);

test.serial(
  "throws error when processing file.processed event for non-json input",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: DestinationCsvFromJsonEvents = {
      description: "destinations to handle file.processed json events",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName,
            path,
          },
        },
      ],
    };

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvFromJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode("not-json")])
      ),
    });

    const errorResponse = await t.throwsAsync(
      handler(sampleFileProcessedEvent),
      {
        instanceOf: ErrorWithContext,
        message: "execution failed",
      }
    );

    const bucketGetInputCalls = buckets.commandCalls(GetObjectCommand, {
      bucketName: inputBucketName,
    });

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.is(bucketGetInputCalls.length, 1);
    t.is(bucketDestinationCalls.length, 0);
    t.is(
      (errorResponse as any).context.rawError.message,
      "unable to parse input as JSON"
    );
  }
);

test.serial(
  "throws error when processing file.processed event for non-array json input",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: DestinationCsvFromJsonEvents = {
      description: "destinations to handle file.processed json events",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName,
            path,
          },
        },
      ],
    };

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvFromJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvFromJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode('{ "notAn": "array" }')])
      ),
    });

    const errorResponse = await t.throwsAsync(
      handler(sampleFileProcessedEvent),
      {
        instanceOf: ErrorWithContext,
        message: "execution failed",
      }
    );

    const bucketGetInputCalls = buckets.commandCalls(GetObjectCommand, {
      bucketName: inputBucketName,
    });

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.is(bucketGetInputCalls.length, 1);
    t.is(bucketDestinationCalls.length, 0);
    t.is(
      (errorResponse as any).context.rawError.context.rejected[0].error.message,
      "input must be a JSON array"
    );
  }
);
