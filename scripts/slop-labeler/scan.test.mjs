import assert from "node:assert/strict";
import { test } from "node:test";
import { scanFiles } from "./scan.mjs";
import { policy } from "./policy.mjs";

function file(source, filename = "source.ts") {
  const lines = source.split("\n");
  return {
    filename,
    status: "added",
    additions: lines.length,
    deletions: 0,
    patch: `@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}`,
    source,
  };
}
const score = (text) => ({ prose: text, words: 30, score: 0.995 });
const read = async (entry) => entry.source;

test("requires distinct matching comment groups, including across files", async () => {
  const a = file("// First explanation.\nconst a = 1;");
  const b = file("// Different explanation.\nconst b = 2;", "other.ts");
  assert.equal((await scanFiles([a], read, score)).flagged, false);
  assert.equal((await scanFiles([a, b], read, score)).flagged, true);
  assert.equal(
    (await scanFiles([a, { ...a, filename: "copy.ts" }], read, score)).flagged,
    false,
  );
});

test("does not scan existing comments, strings, unsupported or generated files", async () => {
  let scored = 0;
  const untouched = {
    filename: "source.ts",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: "@@ -2 +2 @@\n-const x = 1;\n+const x = 2;",
    source: "// Existing explanation.\nconst x = 2;",
  };
  const generated = file(
    "// @generated\n// A generated explanation.\nconst x = 1;",
    "generated.ts",
  );
  const ignored = [
    file("anything", "source.py"),
    file("anything", "vendor/source.ts"),
    file("anything", "source.d.ts"),
    file("anything", "routeTree.gen.ts"),
  ];
  const result = await scanFiles(
    [untouched, generated, ...ignored],
    read,
    (text) => {
      scored++;
      return score(text);
    },
  );
  assert.equal(scored, 0);
  assert.equal(result.flagged, false);
});

test("short or low-scoring comments do not trigger the rule", async () => {
  assert.equal(
    (
      await scanFiles(
        [
          file(
            "// One short comment.\nconst x = 1;\n// Another short comment.",
          ),
        ],
        read,
      )
    ).flagged,
    false,
  );
  assert.equal(
    (
      await scanFiles(
        [file("// First explanation.\nconst x = 1;\n// Another explanation.")],
        read,
        (text) => ({ ...score(text), score: 0.989 }),
      )
    ).flagged,
    false,
  );
});

test("limits or incomplete source fail the whole scan", async () => {
  await assert.rejects(
    scanFiles(
      Array.from({ length: policy.maxFiles + 1 }, (_, index) =>
        file("// Explanation.", `${index}.ts`),
      ),
      read,
      score,
    ),
    /Too many/,
  );
  await assert.rejects(
    scanFiles([{ ...file("// Explanation."), patch: undefined }], read, score),
    /patch/,
  );
  await assert.rejects(
    scanFiles(
      [file("// Explanation.")],
      async () => " ".repeat(policy.maxFileBytes + 1),
      score,
    ),
    /limit/,
  );
  await assert.rejects(
    scanFiles([file("// Explanation.\nconst = broken;")], read, score),
  );
});
