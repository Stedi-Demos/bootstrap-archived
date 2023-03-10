import fs from "fs";

import { invokeFunction } from "../lib/functions.js";

const DEFAULT_LOOP_COUNT = 1;
const DEFAULT_850_PAYLOAD = JSON.parse(
  fs.readFileSync("./src/resources/X12/5010/850/outbound.json", "utf-8")
);

(async () => {
  const functionName = "edi-outbound";
  const loopCount: number = parseInt(process.argv[2]) || DEFAULT_LOOP_COUNT;
  console.log(
    `Invoking ${functionName} function with loop count: ${loopCount}\n`
  );

  const iterations = Array.from(Array(loopCount).keys());
  const promises = iterations.map(async (iteration) => {
    const invocationResult = await invokeFunction(
      functionName,
      DEFAULT_850_PAYLOAD
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
      (result) => result && JSON.parse(result).hasOwnProperty("failureRecord")
    )
  ) {
    console.log("errors encountered during processing");
    process.exit(-1);
  }
})();
