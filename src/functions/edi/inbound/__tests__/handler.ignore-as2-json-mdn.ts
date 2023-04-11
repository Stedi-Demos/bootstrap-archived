import test from "ava";
import { handler } from "../handler.js";
import nock from "nock";
import { sampleS3Event } from "../__fixtures__/events.js";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockGuideClient,
  mockStashClient,
  mockTranslateClient,
} from "../../../../lib/testing/testHelpers.js";

const buckets = mockBucketClient();
const translate = mockTranslateClient();
const stash = mockStashClient();
const guides = mockGuideClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  guides.reset();
  stash.reset();
  translate.reset();
});

for (const extension of ["json", "mdn"]) {
  test.serial(
    `ignores inbound files in a "processed" directory with ${extension} extension`,
    async (t) => {
      const key = `trading_partners/ANOTHERMERCH/processed/as2.${extension}`;
      const result = await handler(sampleS3Event(key));

      t.deepEqual(result, {
        filteredKeys: [
          {
            key,
            reason:
              "key has `.json` or `.mdn` extension in a `processed` directory",
          },
        ],
        processedKeys: [],
        processingErrors: [],
      });
    }
  );
}
