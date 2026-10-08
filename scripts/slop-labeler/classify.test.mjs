import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { scoreComment } from "./classify.mjs";

test("ships the same published model and inference code as the local evaluation", () => {
  const expected = {
    "model.json":
      "228087029eceee8a1c6cd57f29ec484a0141c639f8ed139fd506ef27eaa98825",
    "classifier.mjs":
      "6708c47a4fdf4dfa4b5034c4d2ea9bfacf37a59baae0b762e1b6e670e5a53f75",
    "preprocess.mjs":
      "14c86ef36a82cf603ef8120e5c4cc96a30ec0427650ca42ff20d3eb1217db984",
  };
  for (const [file, hash] of Object.entries(expected)) {
    const bytes = readFileSync(new URL(`./vendor/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
  }
});

test("uses the published human/robot collapse and matches the pre-2021 regression sample", () => {
  const comment = `/**
 * Simple reducer definition with no action shape checks.
 * Uses string comparison to determine action type.
 *
 * \`AnyAction\` type is used to allow action property access without requiring
 * type casting.
 */`;
  const result = scoreComment(comment, "reducers.ts");
  assert.equal(result.words, 28);
  assert.ok(Math.abs(result.score - 0.967694) < 0.000001);
  assert.ok(result.score < 0.99);
});

test("does not classify short comments or stripped license boilerplate", () => {
  assert.equal(scoreComment("// Try again later.", "source.ts").score, null);
  assert.equal(
    scoreComment(
      "/* Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files. */",
      "source.js",
    ).score,
    null,
  );
});
