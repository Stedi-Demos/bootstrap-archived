import { ErrorWithContext } from "./errorWithContext.js";

export class ErrorFromStashConfiguration extends ErrorWithContext {
  constructor(
    configurationKey: string,
    // Zod safeParse result
    parseResult: { error: { issues: { message: string }[] } }
  ) {
    super(`Invalid configuration for key: ${configurationKey}`, {
      details: parseResult.error.issues,
    });
    this.name = "StashConfigurationError";
  }
}
