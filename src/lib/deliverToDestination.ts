import fetch, { RequestInit } from "node-fetch";
import { Destination } from "./types/PartnerRouting";
import {
  PutObjectCommand,
  PutObjectCommandInput,
} from "@stedi/sdk-client-buckets";
import { bucketClient } from "./buckets";

const bucketsClient = bucketClient();

export type DeliveryResult = {
  type: Destination["destination"]["type"];
  payload: any;
}

export const deliverToDestination = async (
  destination: Destination["destination"],
  payload: object | string
): Promise<DeliveryResult> => {
  const result: DeliveryResult = { type: destination.type, payload: {} };

  const body = typeof payload === "object" ? JSON.stringify(payload) : payload;
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
      const response = await fetch(destination.url, params);
      if (!response.ok) {
        throw new Error(
          `delivery to ${destination.url} failed: ${response.statusText} (status code: ${response.status})`
        );
      }

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
