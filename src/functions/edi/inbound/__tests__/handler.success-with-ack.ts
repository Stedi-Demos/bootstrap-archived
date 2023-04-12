import test from "ava";
import { handler } from "../handler.js";
import nock from "nock";
import { sampleS3Event } from "../__fixtures__/events.js";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import {
  mockBucketClient,
  mockExecutionTracking,
  mockGuideClient,
  mockStashClient,
  mockTranslateClient,
} from "../../../../lib/testing/testHelpers.js";
import { GetObjectCommand, PutObjectCommand } from "@stedi/sdk-client-buckets";
import { TranslateX12ToJsonCommand } from "@stedi/sdk-client-edi-translate";
import { Readable } from "stream";
import fs from "node:fs";
import {
  GetValueCommand,
  IncrementValueCommand,
} from "@stedi/sdk-client-stash";
import { GetGuideCommand } from "@stedi/sdk-client-guides";

const buckets = mockBucketClient();
const translate = mockTranslateClient();
const stash = mockStashClient();
const guides = mockGuideClient();

const sample855 = fs.readFileSync(
  "./src/resources/X12/5010/855/inbound.edi",
  "utf8"
);

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

for (const uploadDirectory of ["inbound", "processed"]) {
  test.serial(
    `translates, delivers & acks an incoming X12 file in ${uploadDirectory} directory`,
    async (t) => {
      // loading incoming EDI file from S3
      buckets.on(GetObjectCommand, {}).resolves({
        body: sdkStreamMixin(
          Readable.from([new TextEncoder().encode(sample855)])
        ),
      });

      // mock translate response
      translate.on(TranslateX12ToJsonCommand).resolvesOnce({
        output: {
          transactionSets: [{}],
          envelope: { controlNumber: "123456" },
        },
      });

      stash
        .on(GetValueCommand, { key: "bootstrap|replication-config" }) // mock replication config lookup
        .resolvesOnce({
          value: {
            destinations: [
              {
                destination: {
                  bucketName: "core-ingestion-bucket",
                  path: "replicated-documents",
                  type: "bucket",
                },
              },
            ],
          },
        })
        .on(GetValueCommand, { key: "lookup|ISA|14/ANOTHERMERCH" }) // mock sending partner lookup
        .resolvesOnce({ value: { partnerId: "another-merchant" } })
        .on(GetValueCommand, { key: "lookup|ISA|ZZ/THISISME" }) // mock receiving partner lookup
        .resolvesOnce({ value: { partnerId: "this-is-me" } })
        .on(GetValueCommand, { key: "partnership|another-merchant|this-is-me" }) // mock partnership lookup
        .resolvesOnce({
          value: {
            transactionSets: [
              {
                acknowledgmentConfig: {
                  acknowledgmentType: "997",
                },
                description:
                  "Purchase Order Acknowledgements received from ANOTHERMERCH",
                destinations: [
                  {
                    destination: {
                      type: "webhook",
                      url: "https://webhook.site/TESTING",
                      verb: "POST",
                    },
                  },
                ],
                guideId: "01GRRSB3TXW9Z4J2J75Z9RPR3S",
                receivingPartnerId: "this-is-me",
                sendingPartnerId: "another-merchant",
                usageIndicatorCode: "T",
              },
              {
                description: "Outbound 997 Acknowledgments",
                destinations: [
                  {
                    destination: {
                      bucketName: "test-ftp-bucket",
                      path: "trading_partners/ANOTHERMERCH/outbound",
                      type: "bucket",
                    },
                  },
                ],
                transactionSetIdentifier: "997",
                usageIndicatorCode: "T",
              },
            ],
          },
        })
        .on(IncrementValueCommand, { key: "T|ISA|this-is-me|another-merchant" }) // 997 control number generation ISA
        .resolves({ value: 9 })
        .on(IncrementValueCommand, { key: "T|GS|this-is-me|another-merchant" }) // 997 control number generation GS
        .resolves({ value: 9 });

      // mock guide retrieval
      guides.on(GetGuideCommand).resolvesOnce({
        id: "LIVE_01GRRSB3TXW9Z4J2J75Z9RPR3S",
        target: { standard: "x12", release: "005010", transactionSet: "855" },
      });

      // mock destination webhook delivery
      const webhookRequest = nock("https://webhook.site")
        .post("/TESTING", (body) =>
          t.deepEqual(body, {
            envelope: { controlNumber: "123456" },
            transactionSets: [{}],
          })
        )
        .reply(200, { thank: "you" });

      const key = `trading_partners/ANOTHERMERCH/${uploadDirectory}/inbound.edi`;
      const result = await handler(sampleS3Event(key));

      t.assert(
        webhookRequest.isDone(),
        "delivered guide JSON to destination webhook"
      );

      const replicationPutArgs = buckets.commandCalls(PutObjectCommand, {
        bucketName: "core-ingestion-bucket",
      })[0]!.args[0].input;

      t.assert(replicationPutArgs.key === "replicated-documents/inbound.edi");
      t.assert(replicationPutArgs.body?.toString() === sample855);

      const ackPutArgs = buckets.commandCalls(PutObjectCommand, {
        bucketName: "test-ftp-bucket",
      })[0]!.args[0].input;

      t.assert(
        ackPutArgs.key ===
          "trading_partners/ANOTHERMERCH/outbound/000000009-997.edi"
      );
      t.assert(
        ackPutArgs.body
          ?.toString()
          .match(
            /ISA\*00\*          \*00\*          \*ZZ\*THISISME       \*14\*ANOTHERMERCH   \*\d{6}\*\d{4}\*\^\*00501\*000000009\*0\*T\*\>~GS\*FA\*READDEMO\*072271711TMS\*\d{8}\*\d{6}\*000000009\*X\*005010~ST\*997\*0001~AK1\*PR\*1746~AK9\*A\*1\*1\*1~SE\*4\*0001~GE\*1\*000000009~IEA\*1\*000000009~/
          )?.length === 1
      );

      t.deepEqual(result, {
        filteredKeys: [],
        processedKeys: [key],
        processingErrors: [],
      });
    }
  );
}
