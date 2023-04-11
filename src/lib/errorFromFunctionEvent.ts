import { SafeParseError } from "zod";
import { ErrorWithContext } from "./errorWithContext.js";

export class ErrorFromFunctionEvent extends ErrorWithContext {
  constructor(functionName: string, error: SafeParseError<unknown>) {
    super(`Invalid event sent to function: ${functionName}`, {
      details: error.error.issues,
    });
    this.name = "InvalidFunctionEvent";
  }
}
