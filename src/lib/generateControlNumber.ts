import { IncrementValueCommand } from "@stedi/sdk-client-stash";
import { z } from "zod";
import { stashClient } from "./clients/stash.js";
import { OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME } from "./constants.js";

export const UsageIndicatorCodeSchema = z.enum(["P", "T", "I"]);
export type UsageIndicatorCode = z.infer<typeof UsageIndicatorCodeSchema>;

const stash = stashClient();

type GenerateControlNumberInput = {
  usageIndicatorCode: UsageIndicatorCode;
  segment: "ISA" | "GS";
  sendingPartnerId: string;
  receivingPartnerId: string;
  amount?: number;
};

export const generateControlNumber = async ({
  usageIndicatorCode,
  segment,
  sendingPartnerId,
  receivingPartnerId,
  amount,
}: GenerateControlNumberInput) => {
  const key = `${usageIndicatorCode}|${segment}|${sendingPartnerId}|${receivingPartnerId}`;
  const params = {
    keyspaceName: OUTBOUND_CONTROL_NUMBER_KEYSPACE_NAME,
    key,
    amount: amount ?? 1,
  };
  let { value: controlNumber } = await stash.send(
    new IncrementValueCommand(params)
  );

  if (!controlNumber)
    throw new Error(`Issue generating control number with key: ${key}`);

  controlNumber = controlNumber.toString().padStart(9, "0");
  console.log(`generated control number: ${controlNumber}`);

  return controlNumber;
};
