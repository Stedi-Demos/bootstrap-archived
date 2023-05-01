import consumers from "stream/consumers";
import { Readable } from "node:stream";

import { GetObjectCommand } from "@stedi/sdk-client-buckets";

import {
  failedExecution,
  FailureResponse,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  CoreFileProcessed,
  CoreFileProcessedSchema,
} from "../../../lib/types/FileProcessed.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { ErrorFromFunctionEvent } from "../../../lib/errorFromFunctionEvent.js";
import { loadCsvToJsonDestinations } from "../../../lib/csv/loadCsvToJsonDestinations.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { invokeMapping } from "../../../lib/mappings.js";
import { convertCsvToJson } from "../../../lib/csv/converter.js";
import { getBaseFilenameFromBucketKey } from "../../../lib/getFilenameFromBucketKey.js";
import {
  groupDeliveryResults,
  processSingleDelivery,
  ProcessSingleDeliveryInput,
} from "../../../lib/deliveryManager.js";
import { ensureFileIsDeleted } from "../../edi/inbound/handler.js";

const buckets = bucketsClient();

export const handler = async (
  event: unknown
): Promise<void | FailureResponse> => {
  const executionId = generateExecutionId(event);

  await recordNewExecution(executionId, event);

  const fileProcessedEventParseResult =
    CoreFileProcessedSchema.safeParse(event);

  if (!fileProcessedEventParseResult.success) {
    const error = new ErrorFromFunctionEvent(
      "csv-to-json",
      fileProcessedEventParseResult
    );
    await failedExecution(executionId, error);
    throw error;
  }

  await sendJsonToDestinations(fileProcessedEventParseResult.data);
  await markExecutionAsSuccessful(executionId);
};

const sendJsonToDestinations = async (
  fileProcessedEvent: CoreFileProcessed
) => {
  const { bucketName, key } = fileProcessedEvent.detail.source;
  const csvToJsonDestinations = await loadCsvToJsonDestinations(
    bucketName,
    key
  );

  // early return if no `csv-to-json` destinations are configured
  if (csvToJsonDestinations.length === 0) {
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

  const deliveryResults = await Promise.allSettled(
    csvToJsonDestinations.map(async (destination) => {
      const json = convertCsvToJson(fileContents, destination.parserConfig);

      const jsonToDeliver =
        destination.mappingId !== undefined
          ? await invokeMapping(destination.mappingId, json)
          : json;

      const deliverToDestinationInput: ProcessSingleDeliveryInput = {
        destination: destination.destination,
        payload: jsonToDeliver,
        payloadMetadata: {
          payloadId: getBaseFilenameFromBucketKey(key),
          format: "json",
        },
      };

      return await processSingleDelivery(deliverToDestinationInput);
    })
  );

  const deliveryResultsByStatus = groupDeliveryResults(deliveryResults, {
    payload: fileProcessedEvent,
    destinations: csvToJsonDestinations,
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
