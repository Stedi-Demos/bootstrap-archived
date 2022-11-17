import fs from "fs";

import { PutObjectCommand } from "@stedi/sdk-client-buckets";

import { bucketClient } from "../lib/buckets.js";
import { requiredEnvVar } from "../lib/environment.js";

const DEFAULT_LOOP_COUNT = 5;

const DEFAULT_850_PAYLOAD = fs.readFileSync("./src/resources/X12/5010/850/input.edi", "utf-8");
const DEFAULT_855_PAYLOAD = fs.readFileSync("./src/resources/X12/5010/855/input.edi", "utf-8");
const DEFAULT_FILE_PAYLOADS = [DEFAULT_850_PAYLOAD, DEFAULT_855_PAYLOAD];

const DEFAULT_OBJECT_PREFIX = "trading_partners/ANOTHERMERCH/inbound";

(async () => {
  const loopCount: number = parseInt(process.argv[2]) || DEFAULT_LOOP_COUNT;
  const bucketName = requiredEnvVar("SFTP_BUCKET_NAME");

  console.log(`Uploading ${DEFAULT_FILE_PAYLOADS.length} documents to ${bucketName} with loop count: ${loopCount}\n`);

  const iterations = Array.from(Array(loopCount).keys());
  const promises = iterations.map(async (iteration) => {
    return await Promise.all(DEFAULT_FILE_PAYLOADS.map(async (payload, index) => {
      const key = `${DEFAULT_OBJECT_PREFIX}/input-${iteration}-${index}.edi`;
      await bucketClient().send(new PutObjectCommand({
        bucketName,
        key,
        body: payload,
      }))

      const result = {
        iteration,
        bucketName,
        key,
      };

      console.log(JSON.stringify(result, null, 2));
      return result;
    }));
  });

  await Promise.all(promises);
  console.log(`\nDone. File upload count: ${loopCount * DEFAULT_FILE_PAYLOADS.length}`);
})();
