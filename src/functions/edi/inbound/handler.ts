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
import { loadDestinations } from "../../../lib/loadDestinations.js";
import {
  generateDestinationFilename,
  processDeliveries,
  ProcessDeliveriesInput,
} from "../../../lib/deliveryManager.js";

// Buckets client is shared across handler and execution tracking logic
const buckets = bucketsClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  console.log(JSON.stringify(event, null, 2));
  const executionId = generateExecutionId(event);
  try {
    await recordNewExecution(executionId, event);

    // parse the incoming event against the TransactionEvent schema
    const parseResult = TransactionEventSchema.safeParse(event);

    // skip processing anything that doesn't match (including non-transaction events)
    if (!parseResult.success) {
      console.log("invalid event", parseResult);
      return {};
    }

    const transactionEvent = parseResult.data;

    // skip EDI we're sending (this will be excluded by better EventBrdige rule pattern in future)
    if (transactionEvent.detail.direction === "SENT") return {};

    // load the translated Guide JSON from the bucket
    const getObjectResponse = await buckets.send(
      new GetObjectCommand({
        bucketName: transactionEvent.detail.output.bucketName,
        key: transactionEvent.detail.output.key,
      })
    );

    // grab the Guide JSON that engine output for this incoming file
    const fileContents = await consumers.text(
      getObjectResponse.body as Readable
    );
    const guideJSON = JSON.parse(fileContents);

    // get the destinations for this transaction set
    const { destinations } = await loadDestinations({
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

    const processDeliveriesInput: ProcessDeliveriesInput = {
      destinations,
      payload: guideJSON,
      destinationFilename,
    };

    // await destination deliveries
    await processDeliveries(processDeliveriesInput);

    // Delete the input file (could also archive elsewhere if desired)
    // TODO: source object is needed in event
    // await buckets.send(
    //   new DeleteObjectCommand({
    //     bucketName: transactionEvent.detail.input.bucketName,
    //     key: transactionEvent.detail.input.key,
    //   })
    // );

    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);

    return failedExecution(executionId, error);
  }
};
