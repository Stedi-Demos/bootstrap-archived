import {
  failedExecution,
  FailureResponse,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { TransactionEventSchema } from "../../../lib/types/TransactionEvent.js";
import {
  DeleteObjectCommand,
  GetObjectCommand,
} from "@stedi/sdk-client-buckets";
import consumers from "stream/consumers";
import { Readable } from "node:stream";
import { loadTransactionDestinations } from "../../../lib/loadTransactionDestinations.js";
import {
  generateDestinationFilename,
  processDeliveries,
  ProcessDeliveriesInput,
} from "../../../lib/deliveryManager.js";

// Buckets client is shared across handler and execution tracking logic
const buckets = bucketsClient();

export const handler = async (
  event: unknown
): Promise<Record<string, unknown> | FailureResponse> => {
  console.log(JSON.stringify(event, null, 2));
  const executionId = generateExecutionId(event);
  try {
    await recordNewExecution(executionId, event);

    // parse the incoming event against the TransactionEvent schema
    const transactionEvent = TransactionEventSchema.parse(event);

    // load the translated Guide JSON from the bucket
    const getObjectResponse = await buckets.send(
      new GetObjectCommand({
        bucketName: transactionEvent.detail.output.bucketName,
        key: transactionEvent.detail.output.key,
      })
    );

    // grab the Guide JSON that core output for this incoming file
    const fileContents = await consumers.text(
      getObjectResponse.body as Readable
    );
    const guideJSON = JSON.parse(fileContents) as object;

    // get the destinations for this transaction set
    const { destinations } = await loadTransactionDestinations({
      partnershipId: transactionEvent.detail.partnership.partnershipId,
      transactionSetIdentifier:
        transactionEvent.detail.transaction.transactionSetIdentifier,
    });

    // prepare delivery payloads
    const filenamePrefix = transactionEvent.detail.envelopes.interchange
      .controlNumber
      ? transactionEvent.detail.envelopes.interchange.controlNumber
      : Date.now();

    const destinationFilename = generateDestinationFilename(
      filenamePrefix.toString(),
      transactionEvent.detail.transaction.transactionSetIdentifier,
      "json"
    );

    const envelopeUsageIndicator =
      transactionEvent.detail.envelopes.interchange.usageIndicatorCode;

    const processDeliveriesInput: ProcessDeliveriesInput = {
      destinations,
      payload: guideJSON,
      destinationFilename,
      envelopeUsageIndicator,
    };

    // deliver to destination if usage indicator not set or matches the envelope

    await processDeliveries(processDeliveriesInput);

    // Delete the input file (it is archived by core)
    await ensureFileIsDeleted(
      transactionEvent.detail.input.bucketName,
      transactionEvent.detail.input.key
    );

    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);

    return failedExecution(executionId, error);
  }
};

export const ensureFileIsDeleted = async (bucketName: string, key: string) => {
  try {
    await buckets.send(new DeleteObjectCommand({ bucketName, key }));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ResourceNotFoundException"
    )
      return;
    else throw error;
  }
};
