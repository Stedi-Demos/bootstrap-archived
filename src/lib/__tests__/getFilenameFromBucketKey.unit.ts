import test from "ava";
import {
  getBaseFilenameFromBucketKey,
  getFilenameFromBucketKey,
} from "../getFilenameFromBucketKey.js";

test("should return filename for file in root of bucket", (t) => {
  const key = "filename.txt";
  t.is(getFilenameFromBucketKey(key), "filename.txt");
});

test("should return filename for file in nested directory within bucket", (t) => {
  const key = "path/to/filename.txt";
  t.is(getFilenameFromBucketKey(key), "filename.txt");
});

test("should return base filename when there is an extension", (t) => {
  const key = "filename.txt";
  t.is(getBaseFilenameFromBucketKey(key), "filename");
});

test("should return base filename when there is no extension", (t) => {
  const key = "path/to/filename";
  t.is(getBaseFilenameFromBucketKey(key), "filename");
});

test("should return base filename when there are multiple `.` in the name", (t) => {
  const key = "path/to/filename.with.some.dots.txt";
  t.is(getBaseFilenameFromBucketKey(key), "filename.with.some.dots");
});
