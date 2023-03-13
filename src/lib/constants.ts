import { NodeHttpHandler } from "@aws-sdk/node-http-handler";
import { requiredEnvVar } from "./environment.js";

export const DEFAULT_SDK_CLIENT_PROPS = {
  apiKey: requiredEnvVar("STEDI_API_KEY"),
  region: "us",
  maxAttempts: 5,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5_000,
  }),
};

export const PARTNERS_KEYSPACE_NAME = "partners-configuration";
export const OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME = "outbound-control-numbers";
export const INBOUND_CONTROL_NUMBER_KEYSPACE_NAME = "inbound-control-numbers";
