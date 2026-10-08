import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidRange } from "./semver-range.mjs";

test("accepts the range forms plugin authors use", () => {
  for (const range of [
    ">=2.29.0 <3",
    "^2.30.0",
    "~2.30",
    "2.x",
    "2.29.x",
    "*",
    ">= 2.29.0 < 3",
    ">=2.29.0 <3 || ^4.0.0",
    "2.29.0 - 3.1.0",
    "^3.0.0-beta.1",
    "=2.29.0",
    "v2.29.0",
    "~>2.29",
  ]) {
    assert.equal(isValidRange(range), true, range);
  }
});

test("rejects strings that are not semver ranges", () => {
  for (const range of [
    "",
    "   ",
    "latest",
    "2.29.0.1",
    ">=2.29.0 <",
    ">>2",
    "^01.2.3",
    "1.x.3",
    "2.29.0 -",
    "- 3.0.0",
    ">=2.29.0 ||",
    "2.29.0 || || 3",
    "2.29.0; rm -rf",
    `>=${"1".repeat(300)}`,
  ]) {
    assert.equal(isValidRange(range), false, range);
  }
});

test("rejects values that are not strings", () => {
  for (const value of [undefined, null, 2, [">=2"], { kaneo: ">=2" }]) {
    assert.equal(isValidRange(value), false);
  }
});
