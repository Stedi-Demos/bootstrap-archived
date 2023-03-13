import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { TransactionEventSchema } from "../../../lib/types/TransactionEvent.js";
import { GetObjectCommand } from "@stedi/sdk-client-buckets";
import consumers from "stream/consumers";
import { Readable } from "node:stream";
import { loadPartnershipById } from "../../../lib/loadPartnershipById.js";
import { loadDestinations } from "../../../lib/loadDestinations.js";
import {
  generateDestinationFilename,
  processDeliveries,
  ProcessDeliveriesInput,
} from "../../../lib/deliveryManager.js";

// Buckets client is shared across handler and execution tracking logic
const buckets = bucketsClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  const executionId = generateExecutionId(event);

  console.log(JSON.stringify(event, null, 2));

  const parseResult = TransactionEventSchema.safeParse(event);

  if (!parseResult.success) {
    console.log("invalid event", parseResult);
    return {};
  }

  const transactionEvent = parseResult.data;

  console.log("output", {
    bucketName: transactionEvent.detail.output.bucketName,
    key: transactionEvent.detail.output.key,
  });

  // load the translated Guide JSON from the bucket
  const getObjectResponse = await buckets.send(
    new GetObjectCommand({
      bucketName: transactionEvent.detail.output.bucketName,
      key: transactionEvent.detail.output.key,
    })
  );

  const guideJSON = await consumers.text(getObjectResponse.body as Readable);

  // load the Partnership for the sending and receiving partners
  const partnership = await loadPartnershipById(
    transactionEvent.detail.partnership
  );

  // TODO: from event or stash reference lookup
  const transactionRuleId = "01GVD576APD4A976DHZFH08XFD";

  const destinations = await loadDestinations(transactionRuleId);

  const filenamePrefix = transactionEvent.detail.metadata.interchange
    .controlNumber
    ? transactionEvent.detail.metadata.interchange.controlNumber
    : Date.now();

  const destinationFilename = generateDestinationFilename(
    filenamePrefix.toString(),
    transactionEvent.detail.transaction.transactionSetIdentifier,
    "json"
  );

  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations,
    payload: guideJSON,
    destinationFilename,
  };

  console.log(processDeliveriesInput);
  await processDeliveries(processDeliveriesInput);

  try {
    await recordNewExecution(executionId, event);

    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);

    return failedExecution(executionId, error);
  }
};
