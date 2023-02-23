import test from "ava";
import { buildArchivalPath } from "../buildArchivalPath.js";
import { reset, set } from "mockdate";

test.before(() => set("2023-05-25T18:09:12.451Z"));
test.after(reset);

test("build archive path when file has no extension", (t) => {
  const result = buildArchivalPath({ currentKey: "foo" });

  t.is(result, "archive/2023/05/25/foo_2023-05-25T18:09:12.451Z");
});

test("build archive path when file has extension", (t) => {
  const result = buildArchivalPath({ currentKey: "foo/bar.baz" });

  t.is(result, "archive/2023/05/25/foo/bar_2023-05-25T18:09:12.451Z.baz");
});
