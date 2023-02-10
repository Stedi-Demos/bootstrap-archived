import fetch, { RequestInit } from "node-fetch";

import {
  PutObjectCommand,
  PutObjectCommandInput,
} from "@stedi/sdk-client-buckets";

import { bucketClient } from "./buckets.js";
import { invokeMapping } from "./mappings.js";
import { Destination } from "./types/PartnerRouting.js";

const bucketsClient = bucketClient();

export type DeliveryResult = {
  type: Destination["destination"]["type"];
  payload: any;
}

export type DeliverToDestinationInput = {
  destination: Destination["destination"],
  payload: object | string,
  mappingId?: string,
  destinationFilename?: string,
};

export type DeliverToDestinationListInput = {
  destinations: Destination[];
  payload: object | string;
  destinationFilename?: string;
};

export const deliverToDestination = async (
  input: DeliverToDestinationInput,
): Promise<DeliveryResult> => {
  const result: DeliveryResult = { type: input.destination.type, payload: {} };

  const destinationPayload = input.mappingId !== undefined
    ? await invokeMapping(input.mappingId, input.payload)
    : input.payload;

  const body = typeof destinationPayload === "object"
    ? JSON.stringify(destinationPayload)
    : destinationPayload;

  switch (input.destination.type) {
    case "webhook":
      const params: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      };
      result.payload = params;
      const response = await fetch(input.destination.url, params);
      if (!response.ok) {
        throw new Error(
          `delivery to ${input.destination.url} failed: ${response.statusText} (status code: ${response.status})`
        );
      }

      break;

    case "bucket":
      const key = input.destinationFilename
        ? `${input.destination.path}/${input.destinationFilename}`
        : input.destination.path;
      const putCommandArgs: PutObjectCommandInput = {
        bucketName: input.destination.bucketName,
        key,
        body,
      };
      result.payload = putCommandArgs;
      await bucketsClient.send(new PutObjectCommand(putCommandArgs));

      break;
    default:
      throw new Error("unsupported destination type");
  }

  return result;
};

export const deliverToDestinations = async (
  input: DeliverToDestinationListInput,
): Promise<DeliveryResult[]> => {
  const deliveryResults = await Promise.allSettled(
    input.destinations.map(
      async ({ destination, mappingId }) => {
        console.log(`delivering to destination: ${JSON.stringify(destination)}`);
        const deliverToDestinationInput: DeliverToDestinationInput = {
          destination,
          payload: input.payload,
          mappingId,
          destinationFilename: input.destinationFilename,
        }
        return await deliverToDestination(deliverToDestinationInput);
      }
    )
  );

  const deliveryResultsByStatus = deliveryResults.reduce(
    (
      groupedResults: Record<"fulfilled" | "rejected", any[]>,
      { status, ...rest }
    ) => {
      groupedResults[status].push(rest);
      return groupedResults;
    },
    { fulfilled: [], rejected: [] }
  );

  const rejectedCount = deliveryResultsByStatus.rejected.length;
  if (rejectedCount > 0) {
    console.log(`some deliveries were not successful: ${JSON.stringify(deliveryResultsByStatus)}`);
    throw new Error(
      `some deliveries were not successful: ${rejectedCount} failed, ${deliveryResultsByStatus.fulfilled.length} succeeded`
    );
  }

  return deliveryResultsByStatus.fulfilled.map((r) => r.value);
};

export const generateDestinationFilename = (
  prefix: string,
  transactionSetType: string,
  extension?: string,
): string => {
  const baseFilename = `${prefix}-${transactionSetType}`;
  return extension
    ? `${baseFilename}.${extension}`
    : baseFilename;
};
