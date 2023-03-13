import { serializeError } from "serialize-error";

import { invokeMapping } from "./mappings.js";
import { Destination } from "./types/Destination.js";
import { ErrorWithContext } from "./errorWithContext.js";
import * as as2 from "./destinations/as2.js";
import * as bucket from "./destinations/bucket.js";
import * as fn from "./destinations/function.js";
import * as sftp from "./destinations/sftp.js";
import * as webhook from "./destinations/webhook.js";

export type DeliveryResult = {
  type: Destination["destination"]["type"];
  payload: any;
};

export type ProcessSingleDeliveryInput = {
  destination: Destination["destination"];
  payload: object | string;
  mappingId?: string;
  destinationFilename: string;
};

export type ProcessDeliveriesInput = {
  destinations: Destination[];
  payload: object | string;
  destinationFilename: string;
};

export type DeliverToDestinationInput = {
  destination: Destination["destination"];
  destinationPayload: any;
  destinationFilename: string;
};

const deliveryFnForDestinationType: {
  [type in Destination["destination"]["type"]]: (
    input: DeliverToDestinationInput
  ) => Promise<any>;
} = {
  as2: as2.deliverToDestination,
  bucket: bucket.deliverToDestination,
  function: fn.deliverToDestination,
  sftp: sftp.deliverToDestination,
  webhook: webhook.deliverToDestination,
};

export const processSingleDelivery = async (
  input: ProcessSingleDeliveryInput
): Promise<DeliveryResult> => {
  const destinationPayload =
    input.mappingId !== undefined
      ? await invokeMapping(input.mappingId, input.payload)
      : input.payload;

  const deliverToDestinationInput: DeliverToDestinationInput = {
    destination: input.destination,
    destinationPayload,
    destinationFilename: input.destinationFilename,
  };

  const payload = await deliveryFnForDestinationType[input.destination.type](
    deliverToDestinationInput
  );

  return {
    type: input.destination.type,
    payload,
  };
};

export const processDeliveries = async (
  input: ProcessDeliveriesInput
): Promise<DeliveryResult[]> => {
  const deliveryResults = await Promise.allSettled(
    input.destinations.map(async ({ destination, mappingId }) => {
      console.log(`delivering to ${destination.type} destination`);
      const deliverToDestinationInput: ProcessSingleDeliveryInput = {
        destination,
        payload: input.payload,
        mappingId,
        destinationFilename: input.destinationFilename,
      };
      return await processSingleDelivery(deliverToDestinationInput);
    })
  );

  const deliveryResultsByStatus = groupDeliveryResults(deliveryResults);
  const rejectedCount = deliveryResultsByStatus.rejected.length;
  if (rejectedCount > 0) {
    throw new ErrorWithContext(
      `some deliveries were not successful: ${rejectedCount} failed, ${deliveryResultsByStatus.fulfilled.length} succeeded`,
      deliveryResultsByStatus
    );
  }

  return deliveryResultsByStatus.fulfilled.map((r) => r.value);
};

export const groupDeliveryResults = (
  deliveryResults: PromiseSettledResult<DeliveryResult>[]
): Record<"fulfilled" | "rejected", any[]> => {
  return deliveryResults.reduce(
    (
      groupedResults: Record<"fulfilled" | "rejected", any[]>,
      { status, ...rest }
    ) => {
      // for rejected promises, serialize the reason
      const result =
        status === "rejected"
          ? { reason: serializeError(rest) }
          : { value: rest };
      groupedResults[status].push(result);
      return groupedResults;
    },
    { fulfilled: [], rejected: [] }
  );
};

export const generateDestinationFilename = (
  prefix: string,
  transactionSetType: string,
  extension?: string
): string => {
  const baseFilename = `${prefix}-${transactionSetType}`;
  return extension ? `${baseFilename}.${extension}` : baseFilename;
};

export const payloadAsString = (destinationPayload: any): string => {
  return typeof destinationPayload === "object"
    ? JSON.stringify(destinationPayload)
    : destinationPayload;
};
