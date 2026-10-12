import assert from "node:assert/strict";
import { test } from "node:test";
import { addedLines } from "./changed-lines.mjs";

test("selects new-head lines across hunks, replacements and missing final newlines", () => {
  const file = {
    additions: 3,
    deletions: 1,
    patch:
      "@@ -2,2 +2,3 @@\n unchanged\n-old\n+new\n+\n@@ -20 +21,2 @@ named context\n another\n+last\n\\ No newline at end of file",
  };
  assert.deepEqual([...addedLines(file)], [3, 4, 22]);
});

test("handles added files and ignores deletion-only changes", () => {
  assert.deepEqual(
    [
      ...addedLines({
        additions: 2,
        deletions: 0,
        patch: "@@ -0,0 +1,2 @@\n+// one\n+// two",
      }),
    ],
    [1, 2],
  );
  assert.deepEqual([...addedLines({ additions: 0, deletions: 5 })], []);
});

test("refuses missing, malformed or truncated patches instead of partially scanning", () => {
  for (const patch of [
    undefined,
    "not a patch",
    "@@ -0,0 +1,2 @@\n+only one",
    "@@ -0,0 +1 @@\n+one\n+extra",
  ]) {
    assert.throws(
      () => addedLines({ additions: 2, deletions: 0, patch }),
      /patch/,
    );
  }
  assert.throws(
    () =>
      addedLines({
        additions: 3,
        deletions: 0,
        patch: "@@ -0,0 +1,2 @@\n+one\n@@ -0,0 +4 @@\n+another",
      }),
    /truncated/,
  );
});
