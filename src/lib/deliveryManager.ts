import { invokeMapping } from "./mappings.js";
import { Destination } from "./types/Destination.js";
import * as bucket from "./destinations/bucket.js";
import * as sftp from "./destinations/sftp.js";
import * as webhook from "./destinations/webhook.js";

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

export type DeliveryFnForDestinationTypeInput = {
  destination: Destination["destination"];
  body: any;
  destinationFilename?: string;
};

const deliveryFnForDestinationType: {
  [type in Destination["destination"]["type"]]: (
    input: DeliveryFnForDestinationTypeInput
  ) => Promise<any>;
} = {
  "bucket": bucket.deliverToDestination,
  "sftp": sftp.deliverToDestination,
  "webhook": webhook.deliverToDestination,
};

export const deliverToDestination = async (
  input: DeliverToDestinationInput,
): Promise<DeliveryResult> => {
  const destinationPayload = input.mappingId !== undefined
    ? await invokeMapping(input.mappingId, input.payload)
    : input.payload;

  const body = typeof destinationPayload === "object"
    ? JSON.stringify(destinationPayload)
    : destinationPayload;

  const deliveryFnInput: DeliveryFnForDestinationTypeInput = {
    destination: input.destination,
    body,
    destinationFilename: input.destinationFilename,
  };

  const payload = await deliveryFnForDestinationType[input.destination.type](deliveryFnInput);

  return {
    type: input.destination.type,
    payload,
  };
};

export const deliverToDestinations = async (
  input: DeliverToDestinationListInput,
): Promise<DeliveryResult[]> => {
  const deliveryResults = await Promise.allSettled(
    input.destinations.map(
      async ({ destination, mappingId }) => {
        console.log(`delivering to ${destination.type} destination`);
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
