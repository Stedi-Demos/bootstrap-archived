import consumers from "stream/consumers";
import { Readable } from "stream";

import {
  DeleteObjectCommand,
  GetObjectCommand,
} from "@stedi/sdk-client-buckets";
import * as x12 from "@stedi/x12-tools";

import { processEdi } from "../../../lib/processEdi.js";
import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import {
  Convert,
  Record as BucketNotificationRecord,
} from "../../../lib/types/BucketNotificationEvent.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import {
  FilteredKey,
  GroupedEventKeys,
  KeyToProcess,
  ProcessingResults,
} from "./types.js";
import {
  ProcessDeliveriesInput,
  processDeliveries,
  generateDestinationFilename,
} from "../../../lib/deliveryManager.js";
import { loadPartnership } from "../../../lib/loadPartnership.js";
import { resolveGuide } from "../../../lib/resolveGuide.js";
import { resolvePartnerIdFromISAId } from "../../../lib/resolvePartnerIdFromISAId.js";
import {
  getAckTransactionConfig,
  getTransactionSetConfigsForPartnership,
  groupTransactionSetConfigsByType,
  resolveTransactionSetConfig,
} from "../../../lib/transactionSetConfigs.js";
import { AckDeliveryInput, deliverAck } from "../../../lib/acks.js";
import { TransactionSet } from "../../../lib/types/PartnerRouting.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { archiveFile } from "../../../lib/archive/archiveFile.js";

// Buckets client is shared across handler and execution tracking logic
const buckets = bucketsClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);
    const bucketNotificationEvent = Convert.toBucketNotificationEvent(
      JSON.stringify(event)
    );

    // Extract the object key from each record in the notification event, and split the keys into two groups:
    // - filteredKeys:  keys that won't be processed (notifications for folders or objects not in an `inbound` directory)
    // - keysToProcess: keys for objects in an `inbound` directory, which will be processed by the handler
    const groupedEventKeys = groupEventKeys(bucketNotificationEvent.Records);

    // empty structure to hold the results of each key that is processed
    const results: ProcessingResults = {
      filteredKeys: groupedEventKeys.filteredKeys,
      processingErrors: [],
      processedKeys: [],
    };

    // Iterate through each key that represents an object within an `inbound` directory
    for await (const keyToProcess of groupedEventKeys.keysToProcess) {
      // load the object from the bucket
      const getObjectResponse = await buckets.send(
        new GetObjectCommand(keyToProcess)
      );

      const fileContents = await consumers.text(
        getObjectResponse.body as Readable
      );

      // archive a copy of the input
      const archivalRequest = archiveFile({
        currentKey: keyToProcess.key,
        body: fileContents,
      });

      try {
        // parse EDI and determine what it contains
        const metadata = x12.metadata(fileContents);

        for (const interchange of metadata.interchanges) {
          const { senderId, receiverId, delimiters, interchangeSegments } =
            extractInterchangeData(interchange);

          // resolve the partnerIds for the sending and receiving partners
          const sendingPartnerId = await resolvePartnerIdFromISAId(senderId);
          const receivingPartnerId = await resolvePartnerIdFromISAId(
            receiverId
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

          const groupedTransactionSetConfigs = groupTransactionSetConfigsByType(
            transactionSetConfigs
          );

          // keep track of transaction sets in interchange to determine whether to send ack
          const transactionSetConfigsForInterchange: TransactionSet[] = [];

          const guideIdsForPartnership =
            groupedTransactionSetConfigs.transactionSetConfigsWithGuideIds.map(
              (config) => config.guideId
            );

          for (const functionalGroup of interchange.functionalGroups) {
            const functionalGroupSegments =
              extractFunctionalGroupData(functionalGroup);

            // For each Transaction Set:
            // - look up the guideId
            // - find the corresponding transaction set config from the partnership
            // - call processEdi, which translates X12 to JSON
            // - call deliverToDestination for each destination, which does the following:
            //   - optionally invokes the mapping if one is included in config
            //   - sends the result to the destination
            for (const transactionSet of functionalGroup.transactionSets) {
              const { id: transactionSetId } =
                extractTransactionSetData(transactionSet);

              // load the guide for the transaction set
              const guideSummary = await resolveGuide({
                guideIdsForPartnership,
                transactionSetType: transactionSetId,
                release: functionalGroup.envelope?.release,
              });

              const transactionSetContents = fileContents.slice(
                transactionSet.span.start,
                transactionSet.span.end
              );

              const documentContents = [
                interchangeSegments.isa,
                functionalGroupSegments.gs,
                transactionSetContents,
                functionalGroupSegments.ge,
                interchangeSegments.iea,
              ];

              const edi = documentContents.join(delimiters.segment);

              // find the transaction set config for partnership that includes guide
              const transactionSetConfig = resolveTransactionSetConfig(
                groupedTransactionSetConfigs.transactionSetConfigsWithGuideIds,
                guideSummary.guideId
              );

              transactionSetConfigsForInterchange.push(transactionSetConfig);

              const ediJson = await processEdi(guideSummary.guideId, edi);

              const filenamePrefix = interchange?.envelope?.controlNumber
                ? interchange.envelope.controlNumber
                : Date.now();

              const destinationFilename = generateDestinationFilename(
                filenamePrefix.toString(),
                transactionSetId,
                "json"
              );

              const processDeliveriesInput: ProcessDeliveriesInput = {
                destinations: transactionSetConfig.destinations,
                payload: ediJson,
                destinationFilename,
              };
              await processDeliveries(processDeliveriesInput);
            }
          }

          // if any of the transaction sets included an ack configuration, send ack for interchange
          const transactionSetConfigWithAck =
            transactionSetConfigsForInterchange.find(
              (config) => "acknowledgmentConfig" in config
            );

          if (transactionSetConfigWithAck) {
            const ackTransactionSetConfig = getAckTransactionConfig(
              groupedTransactionSetConfigs.transactionSetConfigsWithoutGuideIds
            );

            // note: sendingPartnerId and receivingPartnerId are flip-flopped from interchange being ack'd
            const ackDeliveryInput: AckDeliveryInput = {
              ackTransactionSet: ackTransactionSetConfig,
              interchange,
              edi: fileContents.slice(
                interchange.span.start,
                interchange.span.end
              ),
              sendingPartnerId: receivingPartnerId,
              receivingPartnerId: sendingPartnerId,
            };
            await deliverAck(ackDeliveryInput);
          }
        }

        // ensure archival is complete
        await archivalRequest;
        // Delete the processed file (could also archive elsewhere if desired)
        await buckets.send(new DeleteObjectCommand(keyToProcess));
        results.processedKeys.push(keyToProcess.key);
      } catch (e) {
        const error = ErrorWithContext.fromUnknown(e);
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
      return failedExecution(
        executionId,
        new ErrorWithContext(message, results)
      );
    }

    await markExecutionAsSuccessful(executionId);

    return results;
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);

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
      if (
        splitKey.length < 2 ||
        !splitKey[splitKey.length - 2].match(/^(inbound|processed)$/)
      ) {
        filteredKeys.push({
          key: eventKey,
          reason:
            "key does not match an item in an `inbound` or `processed` directory",
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

const extractInterchangeData = (
  interchange: x12.Interchange
): {
  senderId: string;
  receiverId: string;
  delimiters: x12.Delimiters;
  interchangeSegments: x12.InterchangeSegments;
} => {
  if (!interchange.envelope) {
    throw new Error("invalid interchange: unable to extract envelope");
  }

  if (!interchange.envelope?.senderId || !interchange.envelope?.receiverId) {
    throw new Error("invalid interchange: unable to extract interchange ids");
  }

  if (!interchange.delimiters) {
    throw new Error("invalid interchange: unable to extract delimiters");
  }

  const senderId = `${
    interchange.envelope.senderQualifier
  }/${interchange.envelope.senderId.trim()}`;
  const receiverId = `${
    interchange.envelope.receiverQualifier
  }/${interchange.envelope.receiverId.trim()}`;

  return {
    senderId,
    receiverId,
    delimiters: interchange.delimiters,
    interchangeSegments: interchange.envelope.segments,
  };
};

const extractFunctionalGroupData = (
  functionalGroup: x12.FunctionalGroup
): x12.FunctionalGroupSegments => {
  if (!functionalGroup.envelope?.segments) {
    throw new Error(
      "invalid functional group: unable to extract functional group segments"
    );
  }

  return functionalGroup.envelope.segments;
};

const extractTransactionSetData = (
  transactionSet: x12.TransactionSet
): { id: string } => {
  if (!transactionSet.id) {
    throw new Error("invalid transaction set: unable to extract identifier");
  }

  return { id: transactionSet.id };
};
