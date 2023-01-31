import consumers from "stream/consumers";
import { Readable } from "stream";
import { serializeError } from "serialize-error";

import {
  DeleteObjectCommand,
  GetObjectCommand,
} from "@stedi/sdk-client-buckets";

import { processEdi } from "../../../lib/processEdi.js";
import {
  failedExecution,
  functionName,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  Convert,
  Record as BucketNotificationRecord,
} from "../../../lib/types/BucketNotificationEvent.js";
import { bucketClient } from "../../../lib/buckets.js";
import {
  FilteredKey,
  GroupedEventKeys,
  KeyToProcess,
  ProcessingResults,
} from "./types.js";
import { trackProgress } from "../../../lib/progressTracking.js";
import { prepareMetadata } from "../../../lib/prepareMetadata.js";
import { deliverToDestination } from "../../../lib/deliverToDestination.js";
import { loadPartnership } from "../../../lib/loadPartnership.js";
import { resolveGuide } from "../../../lib/resolveGuide.js";
import { resolvePartnerIdFromISAId } from "../../../lib/resolvePartnerIdFromISAId.js";
import {
  getTransactionSetConfigsForPartnership,
  resolveTransactionSetConfig,
} from "../../../lib/transactionSetConfigs.js";

// Buckets client is shared across handler and execution tracking logic
const bucketsClient = bucketClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);
  await trackProgress(`starting ${functionName()}`, {
    input: event,
    executionId,
  });

  try {
    await recordNewExecution(executionId, event);
    const bucketNotificationEvent = Convert.toBucketNotificationEvent(
      JSON.stringify(event)
    );

    // Extract the object key from each record in the notification event, and split the keys into two groups:
    // - filteredKeys:  keys that won't be processed (notifications for folders or objects not in an `inbound` directory)
    // - keysToProcess: keys for objects in an `inbound` directory, which will be processed by the handler
    const groupedEventKeys = groupEventKeys(bucketNotificationEvent.Records);
    await trackProgress("grouped event keys", groupedEventKeys);

    // empty structure to hold the results of each key that is processed
    const results: ProcessingResults = {
      filteredKeys: groupedEventKeys.filteredKeys,
      processingErrors: [],
      processedKeys: [],
    };

    // Iterate through each key that represents an object within an `inbound` directory
    for await (const keyToProcess of groupedEventKeys.keysToProcess) {
      // load the object from the bucket
      const getObjectResponse = await bucketsClient.send(
        new GetObjectCommand(keyToProcess)
      );
      const fileContents = await consumers.text(
        getObjectResponse.body as Readable
      );

      try {
        // parse EDI and determine what it contains
        const metadata = prepareMetadata(fileContents);

        for (const { interchange } of metadata) {
          // resolve the partnerIds for the sending and receiving partners
          const sendingPartnerId = await resolvePartnerIdFromISAId(
            interchange.senderId
          );
          const receivingPartnerId = await resolvePartnerIdFromISAId(
            interchange.receiverId
          );

          // load the Partnership for the sending and receiving partners
          const partnership = await loadPartnership(
            sendingPartnerId,
            receivingPartnerId
          );

          // get transaction set configs for partnership
          const transactionSetConfigs = getTransactionSetConfigsForPartnership({
            partnership,
            sendingPartnerId,
            receivingPartnerId,
          });

          const guideIdsForPartnership = transactionSetConfigs.map(
            (config) => config.guideId
          );

          for (const functionalGroup of interchange.functionalGroups) {
            // For each Transaction Set:
            // - look up the guideId
            // - find the corresponding transaction set config from the partnership
            // - call processEdi, which translates X12 to JSON
            // - call deliverToDestination for each destination, which does the following:
            //   - optionally invokes the mapping if one is included in config
            //   - sends the result to the destination
            for (const transactionSet of functionalGroup.transactionSets) {
              // load the guide for the transaction set
              const guideSummary = await resolveGuide({
                guideIdsForPartnership,
                transactionSetType: transactionSet.transactionSetType,
              });

              const transactionSetContents = transactionSet.segments.join(
                interchange.delimiters.segment
              );

              const documentContents = [
                interchange.segments.ISA,
                functionalGroup.segments.GS,
                transactionSetContents,
                functionalGroup.segments.GE,
                interchange.segments.IEA,
              ];

              const edi = documentContents.join(interchange.delimiters.segment);

              // find the transaction set config for partnership that includes guide
              const transactionSetConfig = resolveTransactionSetConfig(
                transactionSetConfigs,
                guideSummary.guideId
              );

              const ediJson = await processEdi(
                guideSummary.guideId,
                edi,
              );

              for (const {
                destination,
                mappingId,
              } of transactionSetConfig.destinations) {
                console.log(
                  "processing",
                  guideSummary.guideId,
                  mappingId,
                  destination
                );

                await deliverToDestination(destination, ediJson, mappingId);
              }
            }
          }
        }

        // Delete the processed file (could also archive in a `processed` directory or in another bucket if desired)
        await bucketsClient.send(new DeleteObjectCommand(keyToProcess));
        results.processedKeys.push(keyToProcess.key);
      } catch (e) {
        const error =
          e instanceof Error
            ? e
            : new Error(`unknown error: ${serializeError(e)}`);
        await trackProgress("error processing document", {
          key: keyToProcess.key,
          error: serializeError(error),
        });
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
      const errorCountMessage = `${errorCount} error${
        errorCount > 1 ? "s" : ""
      }`;
      const message = `encountered ${errorCountMessage} while attempting to process ${keyCountMessage}`;
      return failedExecution(executionId, new Error(message), results);
    }

    await markExecutionAsSuccessful(executionId);
    await trackProgress("results", results);

    return results;
  } catch (e) {
    const error =
      e instanceof Error ? e : new Error(`unknown error: ${JSON.stringify(e)}`);
    await trackProgress("handler error", { error: serializeError(error) });

    // Note, if an infinite Function execution loop is detected by `executionsBucketClient()`
    // the failed execution will not be uploaded to the executions bucket
    return failedExecution(executionId, error);
  }
};

const groupEventKeys = (
  records: BucketNotificationRecord[]
): GroupedEventKeys => {
  const filteredKeys: FilteredKey[] = [];
  const keysToProcess = records.reduce(
    (collectedKeys: KeyToProcess[], record) => {
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
        key: decodeObjectKey(eventKey),
      });
    },
    []
  );

  return {
    filteredKeys,
    keysToProcess,
  };
};

// Object key components are URI-encoded (with `+` used for encoding spaces)
const decodeObjectKey = (objectKey: string): string =>
  decodeURIComponent(objectKey.replace(/\+/g, " "));
