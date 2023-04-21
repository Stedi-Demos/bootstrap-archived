import { SetValueCommand } from "@stedi/sdk-client-stash";
import { stashClient } from "../clients/stash.js";
import { DeliverToDestinationInput, generateDestinationFilename } from "../deliveryManager.js";
import { DocumentType } from "@aws-sdk/types";
import { ErrorWithContext } from "../errorWithContext.js";

const stash = stashClient();

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<unknown> => {
  if (input.destination.type !== "stash") {
    throw new Error("invalid destination type (must be stash)");
  }

  const payloadSize =
    typeof input.destinationPayload === "string"
      ? input.destinationPayload.length
      : JSON.stringify(input.destinationPayload).length;

  if (payloadSize > 400_000) {
    throw new ErrorWithContext(
      "maximum payload size for stash destination exceeded. payload size must be less than 400KB",
      {
        payloadSize: `${Math.ceil(payloadSize / 1024)}KB`,
      }
    );
  }

  const destinationFilename = generateDestinationFilename(
    input.payloadMetadata,
  );

  return await stash.send(
    new SetValueCommand({
      keyspaceName: input.destination.keyspaceName,
      key: `${input.destination.keyPrefix ?? ""}${
        input.destination.keyPrefix ? "/" : ""
      }${destinationFilename}`,
      value: input.destinationPayload as DocumentType,
    })
  );
};
