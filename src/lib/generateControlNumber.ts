import { IncrementValueCommand, StashClient } from "@stedi/sdk-client-stash";

import { DEFAULT_SDK_CLIENT_PROPS } from "./constants.js";
import { UsageIndicatorCode } from "./types/PartnerRouting.js";

const stashClient = new StashClient(DEFAULT_SDK_CLIENT_PROPS);

interface GenerateControlNumberInput {
  usageIndicatorCode: UsageIndicatorCode;
  segment: "ISA" | "GS";
  sendingPartnerId: string;
  receivingPartnerId: string;
  amount?: number;
}

export const generateControlNumber = async ({
  usageIndicatorCode,
  segment,
  sendingPartnerId,
  receivingPartnerId,
  amount,
}: GenerateControlNumberInput) => {
  const key = `${usageIndicatorCode}|${segment}|${sendingPartnerId}|${receivingPartnerId}`;
  let { value: controlNumber } = (await stashClient.send(
    new IncrementValueCommand({
      keyspaceName: "outbound-control-numbers",
      key,
      amount: amount ?? 1,
    })
  )) as { value: number | string };

  if (!controlNumber)
    throw new Error(`Issue generating control number with key: ${key}`);

  controlNumber = controlNumber.toString().padStart(9, "0");
  console.log(`generated control number: ${controlNumber}`);

  return controlNumber;
};
