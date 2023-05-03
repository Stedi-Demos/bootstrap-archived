import consumers from "stream/consumers";
import { Readable } from "node:stream";
import z from "zod";
import { serializeError } from "serialize-error";

import { GetObjectCommand } from "@stedi/sdk-client-buckets";

import {
  failedExecution,
  FailureResponse,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { CoreFileProcessed } from "../../../lib/types/FileProcessed.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { loadCsvFromJsonDestinations } from "../../../lib/csv/loadCsvFromJsonDestinations.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { invokeMapping } from "../../../lib/mappings.js";
import { convertJsonToCsv } from "../../../lib/csv/converter.js";
import { getBaseFilenameFromBucketKey } from "../../../lib/getFilenameFromBucketKey.js";
import {
  groupDeliveryResults,
  processSingleDelivery,
  ProcessSingleDeliveryInput,
} from "../../../lib/deliveryManager.js";
import { ensureFileIsDeleted } from "../../edi/inbound/handler.js";
import { parseCoreFileProcessedEvent } from "../../../lib/csv/parseCoreFileProcessedEvent.js";

const buckets = bucketsClient();

export const handler = async (
  event: unknown
): Promise<void | FailureResponse> => {
  console.log(JSON.stringify(event, null, 2));
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);
    const coreFileEvent = parseCoreFileProcessedEvent(event, "csv-from-json");
    await sendCsvToDestinations(coreFileEvent);
    await markExecutionAsSuccessful(executionId);
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);
    await failedExecution(executionId, error);
  }
};

const sendCsvToDestinations = async (fileProcessedEvent: CoreFileProcessed) => {
  const { bucketName, key } = fileProcessedEvent.detail.source;
  const csvFromJsonDestinations = await loadCsvFromJsonDestinations(
    bucketName,
    key
  );

  // early return if no `csv-from-json` destinations are configured
  if (csvFromJsonDestinations.length === 0) {
    console.log(
      `no matching 'csv-from-json' destinations to deliver to for bucketName=${bucketName}, key=${key}`
    );
    return;
  }

  // load the JSON file that generated the event from the bucket
  const getObjectResponse = await buckets.send(
    new GetObjectCommand({
      bucketName,
      key,
    })
  );
  const fileContents = await consumers.text(getObjectResponse.body as Readable);
  const inputJson = validJsonInput(fileContents);

  const deliveryResults = await Promise.allSettled(
    csvFromJsonDestinations.map(async (destination) => {
      const inputToConvert =
        destination.mappingId !== undefined
          ? await invokeMapping(destination.mappingId, inputJson)
          : inputJson;

      const csv = convertJsonToCsv(
        validJsonArray(inputToConvert),
        destination.parserConfig
      );

      const deliverToDestinationInput: ProcessSingleDeliveryInput = {
        destination: destination.destination,
        payload: csv,
        payloadMetadata: {
          payloadId: getBaseFilenameFromBucketKey(key),
          format: "csv",
        },
      };

      return await processSingleDelivery(deliverToDestinationInput);
    })
  );

  const deliveryResultsByStatus = groupDeliveryResults(deliveryResults, {
    payload: fileProcessedEvent,
    destinations: csvFromJsonDestinations,
  });
  const rejectedCount = deliveryResultsByStatus.rejected.length;
  if (rejectedCount > 0) {
    throw new ErrorWithContext(
      `some deliveries were not successful: ${rejectedCount} failed, ${deliveryResultsByStatus.fulfilled.length} succeeded`,
      deliveryResultsByStatus
    );
  }

  // Delete the input file after processing all deliveries
  await ensureFileIsDeleted(bucketName, key);
};

const validJsonInput = (input: string): unknown => {
  try {
    return JSON.parse(input);
  } catch (e) {
    throw new ErrorWithContext(
      "unable to parse input as JSON",
      serializeError(e)
    );
  }
};

const validJsonArray = (input: unknown): unknown[] => {
  const unknownArraySchema = z.array(z.unknown());
  const parseResult = unknownArraySchema.safeParse(input);

  if (!parseResult.success) {
    throw new Error("input must be a JSON array");
  }

  return parseResult.data;
};
