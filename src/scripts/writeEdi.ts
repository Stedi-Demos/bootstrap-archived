import fs from "fs";

import { IncrementValueCommand } from "@stedi/sdk-client-stash";

import { invokeFunction } from "../lib/functions.js";
import { stashClient } from "../lib/clients/stash.js";
import { Outbound850Schema } from "../resources/X12/5010/850/Outbound850Schema.js";

const DEFAULT_LOOP_COUNT = 1;
const DEFAULT_850_PAYLOAD = JSON.parse(
  fs.readFileSync("./src/resources/X12/5010/850/outbound.json", "utf-8")
) as unknown;

const BUSINESS_IDS_KEYSPACE_NAME = "business-identifiers";
const PO_NUMBER_KEY = "purchase-order-number";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const functionName = "edi-outbound";
  const loopCount: number =
    (process.argv[2] && parseInt(process.argv[2], 10)) || DEFAULT_LOOP_COUNT;
  console.log(
    `Invoking ${functionName} function with loop count: ${loopCount}\n`
  );

  const iterations = Array.from(Array(loopCount).keys());
  const promises = iterations.map(async (iteration) => {
    const date = new Date().toISOString().split("T")[0] ?? "2023-04-14";
    const poNumberResponse = await stashClient().send(
      new IncrementValueCommand({
        keyspaceName: BUSINESS_IDS_KEYSPACE_NAME,
        key: PO_NUMBER_KEY,
        amount: 1,
      })
    );
    const poNumber = (poNumberResponse.value as number | undefined) ?? "1";

    const outboundPayload = Outbound850Schema.parse(DEFAULT_850_PAYLOAD);
    outboundPayload.payload.heading.beginning_segment_for_purchase_order_BEG.purchase_order_number_03 = `PO-${poNumber
      .toString()
      .padStart(5, "0")}`;
    outboundPayload.payload.heading.beginning_segment_for_purchase_order_BEG.date_05 =
      date;

    const invocationResult = await invokeFunction(
      functionName,
      outboundPayload
    );
    return { iteration, invocationResult };
  });

  const results = await Promise.all(promises);
  const invocationResults = results
    .flat()
    .flatMap((result) => result.invocationResult);

  console.log(`\nDone. Batch invocation count: ${loopCount}`);
  console.log(`Results: ${JSON.stringify(invocationResults, null, 2)}`);

  // exit with non-successful response if any failures were encountered
  if (
    invocationResults.some(
      (result) => result && (result as object).hasOwnProperty("failureRecord")
    )
  ) {
    console.log("errors encountered during processing");
    process.exit(-1);
  }
})();
