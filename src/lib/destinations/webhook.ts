import fetch, { RequestInit } from "node-fetch";

import {
  DeliverToDestinationInput,
  payloadAsString,
} from "../deliveryManager.js";
import { WebhookVerb } from "../types/Destination.js";

interface WebhookDeliveryResult {
  method: WebhookVerb;
  url: string;
  status: number;
  body: string;
}

export const deliverToDestination = async (
  input: DeliverToDestinationInput
): Promise<WebhookDeliveryResult> => {
  assertIsWebhookDestination(input);

  if (input.destination.includeSource) {
    input.destination.additionalInput =
      (input.destination.additionalInput as
        | Record<string, unknown>
        | undefined) ?? ({} as Record<string, unknown>);

    (input.destination.additionalInput as Record<string, unknown>).source =
      input.source;
  }

  const method = input.destination.verb;
  const params = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...input.destination.headers,
    },
    body: payloadAsString(
      buildWebhookInput(
        input.destinationPayload,
        input.destination.additionalInput as object | undefined
      )
    ),
  } satisfies RequestInit;

  const response = await fetch(input.destination.url, params);

  if (!response.ok) {
    throw new Error(
      `delivery to ${input.destination.url} failed: ${response.statusText} (status code: ${response.status})`
    );
  }

  return {
    method: method ?? "POST",
    url: input.destination.url,
    status: response.status,
    body: params.body,
  };
};

const buildWebhookInput = (
  destinationPayload: DeliverToDestinationInput["destinationPayload"],
  additionalInput?: object
): string | object => {
  if (additionalInput && typeof destinationPayload === "string") {
    return {
      payload: destinationPayload,
      ...additionalInput,
    };
  } else if (additionalInput && typeof destinationPayload === "object") {
    return {
      ...destinationPayload,
      ...additionalInput,
    };
  }
  return destinationPayload;
};

function assertIsWebhookDestination(
  input: DeliverToDestinationInput
): asserts input is DeliverToDestinationInput & {
  destination: { type: "webhook" };
} {
  if (input.destination.type !== "webhook") {
    throw new Error("invalid destination type (must be stash)");
  }
}
