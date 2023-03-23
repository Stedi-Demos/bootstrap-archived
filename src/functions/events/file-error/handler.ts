import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";
import { EngineFileError } from "../../../lib/types/FileError.js";
import { loadFileErrorDestinations } from "../../../lib/loadFileErrorDestinations.js";

import {
  processDeliveries,
  ProcessDeliveriesInput,
} from "../../../lib/deliveryManager.js";

export const handler = async (event: EngineFileError) => {
  const executionId = generateExecutionId(event);
  try {
    await recordNewExecution(executionId, event);
    await sendErrorToDestination(event);
    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);
    return failedExecution(executionId, error);
  }
};

const sendErrorToDestination = async (event: EngineFileError) => {
  console.log(event);
  const errorDestinations = await loadFileErrorDestinations();

  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations: errorDestinations.destinations,
    payload: event,
    destinationFilename: `${event.detail.fileId}-${new Date().toUTCString()}`,
  };

  await processDeliveries(processDeliveriesInput);
};
