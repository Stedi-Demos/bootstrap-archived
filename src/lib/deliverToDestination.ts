import fetch, { RequestInit } from "node-fetch";
import { Destination } from "./types/PartnerRouting";
import {
  PutObjectCommand,
  PutObjectCommandInput,
} from "@stedi/sdk-client-buckets";
import { bucketClient } from "./buckets";
import { invokeMapping } from "./mappings";

const bucketsClient = bucketClient();

export type DeliveryResult = {
  type: Destination["destination"]["type"];
  payload: any;
}

export const deliverToDestination = async (
  destination: Destination["destination"],
  payload: object | string,
  mappingId?: string,
): Promise<DeliveryResult> => {
  const result: DeliveryResult = { type: destination.type, payload: {} };

  const destinationPayload = mappingId !== undefined
    ? await invokeMapping(mappingId, payload)
    : payload;

  const body = typeof destinationPayload === "object"
    ? JSON.stringify(destinationPayload)
    : destinationPayload;

  switch (destination.type) {
    case "webhook":
      const params: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      };
      result.payload = params;
      await fetch(destination.url, params);
      break;

    case "bucket":
      const putCommandArgs: PutObjectCommandInput = {
        bucketName: destination.bucketName,
        key: destination.path,
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
