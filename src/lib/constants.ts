import dotenv from "dotenv";
import { fromCredentials } from "@stedi/sdk-token-provider";

dotenv.config({ override: true });

export const DEFAULT_SDK_CLIENT_PROPS = {
  ...(process.env.STEDI_API_KEY ? {
    apiKey: process.env.STEDI_API_KEY
  } : {
    token: fromCredentials()
  }),
  region: "us",
};

export const PARTNERS_KEYSPACE_NAME = "partners-configuration";
export const CONTROL_NUMBER_KEYSPACE_NAME = "outbound-control-numbers";
