import { ErrorObject, serializeError } from "serialize-error";

import { invokeMapping } from "./mappings.js";
import { TransactionSetDestinations } from "./types/Destination.js";
import { ErrorWithContext } from "./errorWithContext.js";
import * as as2 from "./destinations/as2.js";
import * as bucket from "./destinations/bucket.js";
import * as fn from "./destinations/function.js";
import * as sftp from "./destinations/sftp.js";
import * as webhook from "./destinations/webhook.js";
import * as stash from "./destinations/stash.js";

type Destination = TransactionSetDestinations["destinations"][0]["destination"];

export interface PayloadMetadata {
  payloadId: string;
  format: "edi" | "json" | "csv";
}

export interface DeliveryResult {
  type: Destination["type"];
  payload: unknown;
}

export interface ProcessSingleDeliveryInput {
  destination: Destination;
  payload: object | string;
  mappingId?: string;
  mappingValidation?: "strict";
  payloadMetadata: PayloadMetadata;
}

export interface ProcessDeliveriesInput {
  destinations: TransactionSetDestinations["destinations"];
  payload: object | string;
  payloadMetadata: PayloadMetadata;
}

export interface DeliverToDestinationInput {
  destination: Destination;
  destinationPayload: string | object;
  payloadMetadata: PayloadMetadata;
}

const deliveryFnForDestinationType: {
  [type in Destination["type"]]: (
    input: DeliverToDestinationInput
  ) => Promise<unknown>;
} = {
  as2: as2.deliverToDestination,
  bucket: bucket.deliverToDestination,
  function: fn.deliverToDestination,
  sftp: sftp.deliverToDestination,
  webhook: webhook.deliverToDestination,
  stash: stash.deliverToDestination,
};

export const processSingleDelivery = async (
  input: ProcessSingleDeliveryInput
): Promise<DeliveryResult> => {
  console.log(`delivering to ${input.destination.type} destination`);
  const destinationPayload: string | object =
    input.mappingId !== undefined
      ? await invokeMapping(
          input.mappingId,
          input.payload,
          input.mappingValidation
        )
      : input.payload;

  const deliverToDestinationInput: DeliverToDestinationInput = {
    destination: input.destination,
    destinationPayload,
    payloadMetadata: input.payloadMetadata,
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
      const deliverToDestinationInput: ProcessSingleDeliveryInput = {
        destination,
        payload: input.payload,
        mappingId,
        payloadMetadata: input.payloadMetadata,
      };
      return await processSingleDelivery(deliverToDestinationInput);
    })
  );

  const deliveryResultsByStatus = groupDeliveryResults(deliveryResults, input);
  const rejectedCount = deliveryResultsByStatus.rejected.length;
  if (rejectedCount > 0) {
    throw new ErrorWithContext(
      `some deliveries were not successful: ${rejectedCount} failed, ${deliveryResultsByStatus.fulfilled.length} succeeded`,
      deliveryResultsByStatus
    );
  }

  return deliveryResultsByStatus.fulfilled;
};

interface GroupedDeliveryResultSettledResult {
  fulfilled: DeliveryResult[];
  rejected: {
    error: ErrorObject;
    destination: Destination;
    payload: string | object;
  }[];
}

export const groupDeliveryResults = (
  deliveryResults: PromiseSettledResult<DeliveryResult>[],
  input: Omit<ProcessDeliveriesInput, "payloadMetadata">
): GroupedDeliveryResultSettledResult => {
  return deliveryResults.reduce(
    (groupedResults: GroupedDeliveryResultSettledResult, group, index) => {
      // for rejected promises, serialize the reason

      if (group.status === "rejected") {
        const destination = input.destinations[index]!;

        groupedResults.rejected.push({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          error: serializeError(group.reason),
          destination: destination.destination,
          payload: input.payload,
        });
      } else {
        groupedResults.fulfilled.push(group.value);
      }
      return groupedResults;
    },
    { fulfilled: [], rejected: [] }
  );
};

export const generateDestinationFilename = (
  metadata: PayloadMetadata,
  baseFilename?: string,
  fileExtension?: string
): string => {
  const baseFilenameSegment = baseFilename ? `-${baseFilename}` : "";

  return `${metadata.payloadId}${baseFilenameSegment}.${
    fileExtension ?? metadata.format
  }`;
};

export const payloadAsString = (
  destinationPayload: object | string
): string => {
  return typeof destinationPayload === "object"
    ? JSON.stringify(destinationPayload)
    : destinationPayload;
};
