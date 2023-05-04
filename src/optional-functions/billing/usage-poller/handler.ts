import { GetValueCommand } from "@stedi/sdk-client-stash";
import { randomUUID } from "crypto";
import fetch, { RequestInit } from "node-fetch";
import { stashClient } from "../../../lib/clients/stash.js";
import { PARTNERS_KEYSPACE_NAME } from "../../../lib/constants.js";
import {
  ProcessDeliveriesInput,
  processDeliveries,
} from "../../../lib/deliveryManager.js";
import { requiredEnvVar } from "../../../lib/environment.js";
import { ConfigurationSchema } from "./Configuration.js";
import { configurationKey } from "./constants.js";

interface UsageExceededPayload {
  message: string;
  threshold: number;
  currentUsage: number;
  estimatedUsage: number;
}

export const handler = async (): Promise<undefined | UsageExceededPayload> => {
  const configurationResponse = await stashClient().send(
    new GetValueCommand({
      keyspaceName: PARTNERS_KEYSPACE_NAME,
      key: configurationKey,
    })
  );

  if (!configurationResponse.value) {
    console.log("no configuration for usage poller");
    return;
  }

  const configuration = ConfigurationSchema.parse(configurationResponse.value);

  const now = new Date();
  const isoNow = now.toISOString();
  const usageUrl = `https://api.billing.stedi.com/2021-09-01/usage?period=${encodeURIComponent(
    isoNow
  )}`;

  const usageResponse = await fetch(usageUrl, {
    headers: {
      Authorization: `Key ${requiredEnvVar("STEDI_API_KEY")}`,
      Accept: "application/json",
    },
  } satisfies RequestInit);

  const { subtotal: usage } = (await usageResponse.json()) as {
    subtotal: number;
  };

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    0,
    0,
    0
  );

  // use 1 day as the minimum elapsed time to avoid calculating on a small spike
  // at the beginning of the month which can lead to false positives
  const pctTimeElapsedInMonth = Math.max(
    0.03,
    (now.getTime() - monthStart.getTime()) /
      (nextMonthStart.getTime() - monthStart.getTime())
  );

  // assume no trend in usage
  const smoothMonthEndExpectedUsage =
    Math.round((usage / pctTimeElapsedInMonth) * 100) / 100;

  const largestThresholdTriggered = configuration.destinations
    .sort((a, b) => b.threshold - a.threshold)
    .find((x) => x.threshold < smoothMonthEndExpectedUsage);

  if (!largestThresholdTriggered) {
    console.log("no threshold reached", {
      currentUsage: usage,
      estimatedUsage: smoothMonthEndExpectedUsage,
    });
    return;
  }

  const payload: UsageExceededPayload = {
    message: "Expected month end usage exceeds configured threshold",
    threshold: largestThresholdTriggered.threshold,
    currentUsage: usage,
    estimatedUsage: smoothMonthEndExpectedUsage,
  };

  console.log(payload);

  const processDeliveriesInput: ProcessDeliveriesInput = {
    destinations: [largestThresholdTriggered],
    payload,
    payloadMetadata: {
      payloadId: randomUUID(),
      format: "json",
    },
  };
  await processDeliveries(processDeliveriesInput);

  return payload;
};
