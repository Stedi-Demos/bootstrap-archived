import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { CoreFileError } from "../../../lib/types/FileError.js";
import { loadFileErrorDestinations } from "../../../lib/loadFileErrorDestinations.js";

import {
  processDeliveries,
  ProcessDeliveriesInput,
} from "../../../lib/deliveryManager.js";

export const handler = async (event: CoreFileError) => {
  const executionId = generateExecutionId(event);
  try {
    await recordNewExecution(executionId, event);
    await sendErrorToDestination(event);
    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);
    const failureResponse = await failedExecution(event, executionId, error);
    return failureResponse;
  }
};

const sendErrorToDestination = async (event: CoreFileError) => {
  console.log(event);
  const errorDestinations = await loadFileErrorDestinations();

  const processDeliveriesInput: ProcessDeliveriesInput = {
    source: undefined,
    destinations: errorDestinations.destinations,
    payload: event,
    payloadMetadata: {
      payloadId: `${event.detail.fileId}-${new Date().toISOString()}`,
      format: "json",
    },
  };

  await processDeliveries(processDeliveriesInput);
};
