import test from "ava";
import { archiveFile } from "../archiveFile.js";
import { reset, set } from "mockdate";
import { mockBucketClient } from "../../testing/testHelpers.js";
import { requiredEnvVar } from "../../environment.js";

const buckets = mockBucketClient();

test.before(() => set("2023-05-25T18:09:12.451Z"));

test.after(reset);

test("archives file using date specific folder structure, and timestamp suffix", async (t) => {
  await archiveFile({ currentKey: "foo", body: "bar" });

  t.like(buckets.calls()[0].args[0].input, {
    bucketName: "executions-bucket",
    key: "archive/2023/05/25/foo_2023-05-25T18:09:12.451Z",
  });
});
