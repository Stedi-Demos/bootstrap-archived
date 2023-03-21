import { serializeError } from "serialize-error";

export class ErrorWithContext extends Error {
  constructor(message: string, public readonly context: object) {
    super(message);
    this.name = "ErrorWithContext";
  }

  static fromUnknown(e: unknown) {
    return e instanceof ErrorWithContext
      ? e
      : new ErrorWithContext(`unknown error`, { context: serializeError(e) });
  }
}
