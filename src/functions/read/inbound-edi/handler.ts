import fetch from "node-fetch";
import consumers from 'stream/consumers';
import { Readable } from "stream";
import { serializeError } from "serialize-error";

import { DeleteObjectCommand, GetObjectCommand } from "@stedi/sdk-client-buckets";

import { processEdiDocument } from "../../../lib/ediProcessor.js";
import {
  failedExecution,
  functionName,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution
} from "../../../lib/execution.js";
import { Convert, Record as BucketNotificationRecord } from "../../../lib/types/BucketNotificationEvent.js";
import { bucketClient } from "../../../lib/buckets.js";
import { FilteredKey, GroupedEventKeys, KeyToProcess, ReadInboundEdiResults } from "./types.js";
import { getResourceIdsForTransactionSets, requiredEnvVar } from "../../../lib/environment.js";
import { trackProgress } from "../../../lib/progressTracking.js";
import { ediSplitter } from "../../../lib/ediSplitter.js";

// Buckets client is shared across handler and execution tracking logic
const bucketsClient = bucketClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);
  await trackProgress(`starting ${functionName()}`, { input: event, executionId });

  try {
    await recordNewExecution(executionId, event);
    const bucketNotificationEvent = Convert.toBucketNotificationEvent(JSON.stringify(event));

    // Fail fast if required env vars are missing
    const destinationWebhookUrl = requiredEnvVar("DESTINATION_WEBHOOK_URL");

    // Extract the object key from each record in the notification event, and split the keys into two groups:
    // - filteredKeys:  keys that won't be processed (notifications for folders or objects not in an `inbound` directory)
    // - keysToProcess: keys for objects in an `inbound` directory, which will be processed by the handler
    const groupedEventKeys = groupEventKeys(bucketNotificationEvent.Records);
    await trackProgress("grouped event keys", groupedEventKeys);

    // empty structure to hold the results of each key that is processed
    const results: ReadInboundEdiResults = {
      filteredKeys: groupedEventKeys.filteredKeys,
      processingErrors: [],
      processedKeys: [],
    }

    // Iterate through each key that represents an object within an `inbound` directory
    for await (const keyToProcess of groupedEventKeys.keysToProcess) {
      const getObjectResponse = await bucketsClient.send(new GetObjectCommand(keyToProcess));
      const fileContents = await consumers.text(getObjectResponse.body as Readable);

      try {
        // Split EDI input into multiple documents if there are multiple functional groups
        // within an interchange, or multiple interchanges in the same file
        const splitEdiDocuments = ediSplitter(fileContents);
        await trackProgress("split edi documents", splitEdiDocuments);

        // Grab all guide and mapping ids for the transaction sets found in the input (fail early if any are missing)
        const transactionSets = splitEdiDocuments.map(document => document.code);
        const resourceIdsByTransactionSetMap = getResourceIdsForTransactionSets(transactionSets);

        // For each EDI document:
        // - look up the guideId and mappingId
        // - call processEdiDocument, which translates X12 to JSON, and then invokes the mapping
        // - send the result to the webhook
        // - delete the input file once processed successfully
        for await (const ediDocument of splitEdiDocuments) {
          const guideId = requiredString("guideId", resourceIdsByTransactionSetMap.get(ediDocument.code)?.guideId);
          const mappingId = requiredString("mappingId", resourceIdsByTransactionSetMap.get(ediDocument.code)?.mappingId);

          const ediProcessingResult = await processEdiDocument(guideId, mappingId, ediDocument.edi);

          await fetch(
            destinationWebhookUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(ediProcessingResult),
            }
          );

        }

        // Delete the processed file (could also archive in a `processed` directory or in another bucket if desired)
        await bucketsClient.send(new DeleteObjectCommand(keyToProcess));
        results.processedKeys.push(keyToProcess.key);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(`unknown error: ${serializeError(e)}`);
        await trackProgress("error processing document", { key: keyToProcess.key, error: serializeError(error) });
        results.processingErrors.push({
          key: keyToProcess.key,
          error,
        });
      }
    }

    // if any keys failed to process successfully, mark the execution as failed to enable triage
    const errorCount = results.processingErrors.length;
    if (errorCount > 0) {
      const keyCount = groupedEventKeys.keysToProcess.length;
      const keyCountMessage = `${keyCount} key${keyCount > 1 ? "s" : ""}`;
      const errorCountMessage = `${errorCount} error${errorCount > 1 ? "s" : ""}`;
      const message = `encountered ${errorCountMessage} while attempting to process ${keyCountMessage}`;
      return failedExecution(executionId, new Error(message));
    }

    await markExecutionAsSuccessful(executionId);
    await trackProgress("results", results);

    return results;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    await trackProgress("handler error", { error: serializeError(error) });

    // Note, if an infinite Function execution loop is detected by `executionsBucketClient()`
    // the failed execution will not be uploaded to the executions bucket
    return failedExecution(executionId, error);
  }
};

const groupEventKeys = (records: BucketNotificationRecord[]): GroupedEventKeys => {
  const filteredKeys: FilteredKey[] = [];
  const keysToProcess = records.reduce((collectedKeys: KeyToProcess[], record) => {
    const eventKey = record.s3.object.key;

    if (eventKey.endsWith("/")) {
      filteredKeys.push({
        key: eventKey,
        reason: "key represents a folder",
      });
      return collectedKeys;
    }
    const splitKey = eventKey.split("/");
    if (splitKey.length < 2 || splitKey[splitKey.length - 2] !== "inbound") {
      filteredKeys.push({
        key: eventKey,
        reason: "key does not match an item in an `inbound` directory",
      });
      return collectedKeys;
    }

    return collectedKeys.concat({
      bucketName: record.s3.bucket.name,
      key: eventKey,
    });
  }, []);

  return {
    filteredKeys,
    keysToProcess,
  }
};

const requiredString = (key: string, value?: string): string => {
  if (!value) {
    throw new Error(`required value missing for ${key}`);
  }

  return value;
};