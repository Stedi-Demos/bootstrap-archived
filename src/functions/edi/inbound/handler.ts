import {
  failedExecution,
  generateExecutionId,
  markExecutionAsSuccessful,
  recordNewExecution,
} from "../../../lib/execution.js";
import { bucketsClient } from "../../../lib/clients/buckets.js";
import { ErrorWithContext } from "../../../lib/errorWithContext.js";

// Buckets client is shared across handler and execution tracking logic
const buckets = bucketsClient();

export const handler = async (event: any): Promise<Record<string, any>> => {
  console.log(JSON.stringify(event, null, 2));
  const executionId = generateExecutionId(event);

  try {
    await recordNewExecution(executionId, event);

    await markExecutionAsSuccessful(executionId);

    return {};
  } catch (e) {
    const error = ErrorWithContext.fromUnknown(e);

    return failedExecution(executionId, error);
  }
};
