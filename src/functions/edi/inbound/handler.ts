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
    const { envelopes } = transactionEvent.detail;
    const payloadIdEnvelopeSegment = `${envelopes.interchange.controlNumber}-${envelopes.functionalGroup.controlNumber}`;
    const payloadIdTransactionSegment = `${transactionEvent.detail.transaction.controlNumber}-${transactionEvent.detail.transaction.transactionSetIdentifier}`;
    const payloadId = `${payloadIdEnvelopeSegment}-${payloadIdTransactionSegment}`;

    const { usageIndicatorCode } =
      transactionEvent.detail.envelopes.interchange;
    const { release } = transactionEvent.detail.envelopes.functionalGroup;

    // filter out destinations that target specific releases and usage indicators
    // which do not match the payload data
    const filteredDestinations = destinations.filter((d) =>
      filterDestination(d, { usageIndicatorCode, release })
    );

    const processDeliveriesInput: ProcessDeliveriesInput = {
      destinations: filteredDestinations,
      payload: guideJSON,
      payloadMetadata: {
        payloadId,
        format: "json",
      },
    };

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

    const failureResponse = await failedExecution(executionId, error);
    return failureResponse;
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

const filterDestination = (
  destination: { usageIndicatorCode?: string; release?: string },
  envelopeData: { usageIndicatorCode: string; release: string }
) => {
  if (
    destination.usageIndicatorCode &&
    destination.usageIndicatorCode !== envelopeData.usageIndicatorCode
  ) {
    return false;
  }

  if (destination.release && envelopeData.release !== destination.release) {
    return false;
  }

  return true;
};
