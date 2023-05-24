import test from "ava";
import z from "zod";
import { handler } from "../handler.js";
import { GetValueCommand } from "@stedi/sdk-client-stash";
import { PARTNERS_KEYSPACE_NAME } from "../../../../lib/constants.js";
import {
  DestinationCsvToJsonEvents,
  destinationCsvToJsonEventsKey,
  DestinationCsvToJsonEventsSchema,
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
import { customCsvInput, defaultInput } from "../__fixtures__/inputs.js";
import {
  customParserConfigOutputAsString,
  defaultOutputAsString,
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
  "processes incoming core file.processed event, converts csv to json, and sends to configured destination",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: DestinationCsvToJsonEvents = {
      description: "destinations to handle file.processed csv events",
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
        key: destinationCsvToJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvToJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode(defaultInput)])
      ),
    });

    await handler(sampleFileProcessedEvent);

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.deepEqual(bucketDestinationCalls[0]!.args[0].input, {
      bucketName,
      key: `${path}/${inputBaseFilename}.json`,
      body: defaultOutputAsString,
    });
  }
);

test.serial(
  "processes incoming core file.processed event and converts csv to json using custom parser config if specified",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";

    const configValue: z.input<typeof DestinationCsvToJsonEventsSchema> = {
      description: "destinations to handle file.processed csv events",
      destinations: [
        {
          destination: {
            type: "bucket",
            bucketName,
            path,
          },
          parserConfig: {
            delimiter: "--",
            header: false,
            newline: "\r",
          },
        },
      ],
    };

    stash
      .on(GetValueCommand, {
        keyspaceName: PARTNERS_KEYSPACE_NAME,
        key: destinationCsvToJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvToJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode(customCsvInput)])
      ),
    });

    await handler(sampleFileProcessedEvent);

    const bucketDestinationCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName,
    });

    t.deepEqual(bucketDestinationCalls[0]!.args[0].input, {
      bucketName,
      key: `${path}/${inputBaseFilename}.json`,
      body: customParserConfigOutputAsString,
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
        key: destinationCsvToJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvToJsonEventsKey,
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
  "throws error when processing file.processed event for non-csv input",
  async (t) => {
    const bucketName = "testBucket";
    const path = "test-path";
    const configValue: DestinationCsvToJsonEvents = {
      description: "destinations to handle file.processed csv events",
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
        key: destinationCsvToJsonEventsKey,
      }) // mock destinations lookup
      .resolvesOnce({
        key: destinationCsvToJsonEventsKey,
        value: configValue,
      });

    buckets.on(GetObjectCommand, {}).resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode('{ "not": "a csv" }')])
      ),
    });

    const errorResponse = await t.throwsAsync(
      handler(sampleFileProcessedEvent),
      {
        instanceOf: ErrorWithContext,
        message:
          "execution failed [id=cd7e25d9eae76341dc8fb281c1d444590bb581c1]: some deliveries were not successful: 1 failed, 0 succeeded",
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
      (errorResponse as any).context.rejected[0].error.message,
      "error encountered converting CSV to JSON"
    );
  }
);
