import { serializeError } from "serialize-error";

export class ErrorWithContext extends Error {
  constructor(
    message: string,
    public readonly context: object | { rawError: Error } | Error
  ) {
    const cause =
      "cause" in context
        ? context.cause
        : "rawError" in context
        ? context.rawError.cause
        : undefined;
    super(message, { cause });
    this.name = "ErrorWithContext";
  }

  static fromUnknown(e: unknown) {
    return e instanceof ErrorWithContext
      ? e
      : e instanceof Error
      ? new ErrorWithContext(e.message, serializeError(e))
      : new ErrorWithContext(`unknown error`, serializeError(e));
  }
}
