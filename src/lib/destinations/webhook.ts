import fetch, { RequestInit } from "node-fetch";

import { WebhookVerb } from "../types/Destination.js";
import { DeliveryFnForDestinationTypeInput } from "../deliveryManager.js";

type WebhookDeliveryResult = {
  method: WebhookVerb;
  url: string;
  status: number;
};

export const deliverToDestination = async (
  input: DeliveryFnForDestinationTypeInput
): Promise<WebhookDeliveryResult> => {
  if(input.destination.type !== "webhook") {
    throw new Error("invalid destination type (must be webhook)");
  }

  const method = input.destination.verb;
  const params: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...input.destination.headers,
    },
    body: input.body,
  };

  const response = await fetch(input.destination.url, params);
  if (!response.ok) {
    throw new Error(
      `delivery to ${input.destination.url} failed: ${response.statusText} (status code: ${response.status})`
    );
  }

  return {
    method,
    url: input.destination.url,
    status: response.status,
  };
};