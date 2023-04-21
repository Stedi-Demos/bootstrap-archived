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
import { DocumentObject } from "../../../lib/types/JsonObject.js";

export const handler = async (event: CoreFileError) => {
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

const sendErrorToDestination = async (event: CoreFileError) => {
  console.log(event);
  const errorDestinations = await loadFileErrorDestinations();

  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations: errorDestinations.destinations,
    payload: event as DocumentObject,
    destinationFilename: `${event.detail.fileId}-${new Date().toUTCString()}`,
  };

  await processDeliveries(processDeliveriesInput);
};
