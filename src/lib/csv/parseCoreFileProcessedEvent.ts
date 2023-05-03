import {
  CoreFileProcessed,
  CoreFileProcessedSchema,
} from "../types/FileProcessed.js";
import { ErrorFromFunctionEvent } from "../errorFromFunctionEvent.js";

export const parseCoreFileProcessedEvent = (
  event: unknown,
  functionName: string
): CoreFileProcessed => {
  const fileProcessedEventParseResult =
    CoreFileProcessedSchema.safeParse(event);

  if (!fileProcessedEventParseResult.success) {
    throw new ErrorFromFunctionEvent(
      functionName,
      fileProcessedEventParseResult
    );
  }

  return fileProcessedEventParseResult.data;
};
