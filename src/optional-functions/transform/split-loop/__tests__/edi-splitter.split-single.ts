import test from "ava";
import nock from "nock";
import sinon from "sinon";
import {
  mockBucketClient,
  mockExecutionTracking,
} from "../../../../lib/testing/testHelpers.js";
import { GetObjectCommand, PutObjectCommand } from "@stedi/sdk-client-buckets";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { Readable } from "node:stream";
import { handler } from "../handler.js";
import fixture from "../__fixtures__/multi-gs-multi-txn-multi-lx.json" assert { type: "json" };
import config from "../configuration.js";
import { Configuration } from "../types.js";

const buckets = mockBucketClient();

test.beforeEach(() => {
  nock.disableNetConnect();
  mockExecutionTracking(buckets);
});

test.afterEach.always(() => {
  buckets.reset();
  sinon.restore();
});

test.serial("splits file by transaction set", async (t) => {
  sinon.replace(config, "configuration", {
    target: {
      bucketName: "test-target-bucket",
      keyPrefix: "split-loop/",
    },
    splitSegment: { start: "LX", end: ["L3"] },
    chunkSize: 2,
    transactionSetId: "210",
  } satisfies Configuration);

  buckets
    .on(GetObjectCommand, { key: "heckinchonk.edi", bucketName: "my-bucket" })
    .resolvesOnce({
      body: sdkStreamMixin(
        Readable.from([new TextEncoder().encode((fixture as any).data)])
      ),
    });

  buckets.on(PutObjectCommand, { bucketName: "processed-bucket" }).resolves({});

  const result = await handler({
    detail: {
      input: {
        bucketName: "my-bucket",
        key: "heckinchonk.edi",
        type: "EDI/X12",
      },
      direction: "RECEIVED",
      errors: [],
      fileId: "test-file-id",
      version: "2023-02-13",
    },
  });

  const putObjectCalls = buckets.commandCalls(PutObjectCommand, {
    bucketName: "test-target-bucket",
  });

  t.is(putObjectCalls.length, 12);
  t.is(putObjectCalls[0]?.args[0].input.key, "split-loop/heckinchonk.edi-1-12");
  t.is(
    putObjectCalls[1]?.args[0].input.body,
    "ISA*00*          *00*          *02*UPSN           *ZZ*OTHER          *230427*1335*U*00401*1*0*T*>~GS*IM*00*00*20230427*133500*1*X*004030~ST*210*0001~B3**XX**PP**20230426*000000000000****XXXX*20230426~C3*USD~ITD*01~N9*18*XX~N1*BT*XXXX~N2*XXXX~N3*X*XXXXX~N4*XXXXXXX*XX*XXXXXX*XXX~N1*SH*XXXX*25*XXX~N2*X~N3*XXX*XX~N4*XXX*XX*XXX*XX~N9*ST*XXXXXX~LX*00002~N9*ZZ*XXXX*XX*20230426***ZZ>XX>ZZ>XX>ZZ>XX~L5*000*XXXXX~L0*000*0000*XX*000*B***000000*PCS**L~L1*000***00000000000****LDG****XXXX*********000*00000000~L4*0000000*000000*0000000*X**X~N1*RT*XX~N2*X~N3*X*XXXXX~N4*XXXXX*XX*XXXXXXXX*XXX*XX*XX~N9*CR*XXXX*XXXX~CD3*G*0000*XX*0000*ND~N9*2I*XXX~LX*00003~N9*ZZ*XXXX*XX*20230426***ZZ>XX>ZZ>XX>ZZ>XX~L5*000*XXXXX~L0*000*0000*XX*000*B***000000*PCS**L~L1*000***00000000000****LDG****XXXX*********000*00000000~L4*0000000*000000*0000000*X**X~N1*RT*XX~N2*X~N3*X*XXXXX~N4*XXXXX*XX*XXXXXXXX*XXX*XX*XX~N9*CR*XXXX*XXXX~CD3*G*0000*XX*0000*ND~N9*2I*XXX~L3*****00~SE*29*0001~GE*1*1~IEA*1*1~"
  );

  t.is(putObjectCalls[8]?.args[0].input.key, "split-loop/heckinchonk.edi-9-12");
  t.is(
    putObjectCalls[8]?.args[0].input.body,
    "ISA*00*          *00*          *02*UPSN           *ZZ*OTHER          *230427*1335*U*00401*1*0*T*>~GS*IM*00*00*20230427*133500*2*X*004030~ST*210*0002~B3**XX**PP**20230426*000000000000****XXXX*20230426~C3*USD~ITD*01~N9*18*XX~N1*BT*XXXX~N2*XXXX~N3*X*XXXXX~N4*XXXXXXX*XX*XXXXXX*XXX~N1*SH*XXXX*25*XXX~N2*X~N3*XXX*XX~N4*XXX*XX*XXX*XX~N9*ST*XXXXXX~LX*00004~N9*ZZ*XXXX*XX*20230426***ZZ>XX>ZZ>XX>ZZ>XX~L5*000*XXXXX~L0*000*0000*XX*000*B***000000*PCS**L~L1*000***00000000000****LDG****XXXX*********000*00000000~L4*0000000*000000*0000000*X**X~N1*RT*XX~N2*X~N3*X*XXXXX~N4*XXXXX*XX*XXXXXXXX*XXX*XX*XX~N9*CR*XXXX*XXXX~CD3*G*0000*XX*0000*ND~N9*2I*XXX~L3*****00~SE*29*0002~GE*1*2~IEA*1*1~"
  );

  t.is(
    putObjectCalls[9]?.args[0].input.key,
    "split-loop/heckinchonk.edi-10-12"
  );
  t.is(
    putObjectCalls[9]?.args[0].input.body,
    "ISA*00*          *00*          *02*UPSN           *ZZ*OTHER          *230427*1335*U*00401*1*0*T*>~GS*IM*00*00*20230427*133500*3*X*004030~ST*210*0001~B3**XX**PP**20230426*000000000000****XXXX*20230426~C3*USD~ITD*01~N9*18*XX~N1*BT*XXXX~N2*XXXX~N3*X*XXXXX~N4*XXXXXXX*XX*XXXXXX*XXX~N1*SH*XXXX*25*XXX~N2*X~N3*XXX*XX~N4*XXX*XX*XXX*XX~N9*ST*XXXXXX~LX*00000~N9*ZZ*XXXX*XX*20230426***ZZ>XX>ZZ>XX>ZZ>XX~L5*000*XXXXX~L0*000*0000*XX*000*B***000000*PCS**L~L1*000***00000000000****LDG****XXXX*********000*00000000~L4*0000000*000000*0000000*X**X~N1*RT*XX~N2*X~N3*X*XXXXX~N4*XXXXX*XX*XXXXXXXX*XXX*XX*XX~N9*CR*XXXX*XXXX~CD3*G*0000*XX*0000*ND~N9*2I*XXX~LX*00001~N9*ZZ*XXXX*XX*20230426***ZZ>XX>ZZ>XX>ZZ>XX~L5*000*XXXXX~L0*000*0000*XX*000*B***000000*PCS**L~L1*000***00000000000****LDG****XXXX*********000*00000000~L4*0000000*000000*0000000*X**X~N1*RT*XX~N2*X~N3*X*XXXXX~N4*XXXXX*XX*XXXXXXXX*XXX*XX*XX~N9*CR*XXXX*XXXX~CD3*G*0000*XX*0000*ND~N9*2I*XXX~L3*****00~SE*29*0001~GE*1*3~IEA*1*1~"
  );

  t.is((result as { count: number }).count, 12);
});

test.serial(
  "takes no action for transaction set Ids not matching config",
  async (t) => {
    sinon.replace(config, "configuration", {
      target: {
        bucketName: "test-target-bucket",
        keyPrefix: "split-loop/",
      },
      splitSegment: { start: "LX", end: ["L3"] },
      chunkSize: 2,
      transactionSetId: "101",
    } satisfies Configuration);

    buckets
      .on(GetObjectCommand, { key: "heckinchonk.edi", bucketName: "my-bucket" })
      .resolvesOnce({
        body: sdkStreamMixin(
          Readable.from([new TextEncoder().encode((fixture as any).data)])
        ),
      });

    buckets
      .on(PutObjectCommand, { bucketName: "processed-bucket" })
      .resolves({});

    const result = await handler({
      detail: {
        input: {
          bucketName: "my-bucket",
          key: "heckinchonk.edi",
          type: "EDI/X12",
        },
        direction: "RECEIVED",
        errors: [],
        fileId: "test-file-id",
        version: "2023-02-13",
      },
    });

    const putObjectCalls = buckets.commandCalls(PutObjectCommand, {
      bucketName: "test-target-bucket",
    });

    t.is(putObjectCalls.length, 0);
    t.assert(result, "0");
  }
);
