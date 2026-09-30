import assert from "node:assert/strict";
import test from "node:test";
import { assessRuns } from "./require-ci.mjs";

const sha = "a".repeat(40);
const passed = {
  head_sha: sha,
  head_branch: "main",
  event: "push",
  run_number: 1,
  run_attempt: 1,
  status: "completed",
  conclusion: "success",
};
test("release requires successful main push CI on the exact SHA", () => {
  assert.equal(assessRuns([passed], sha), "success");
  assert.equal(
    assessRuns([{ ...passed, event: "workflow_dispatch" }], sha),
    "success",
  );
  for (const override of [
    { head_sha: "b".repeat(40) },
    { event: "pull_request" },
    { head_branch: "other" },
  ]) {
    assert.equal(assessRuns([{ ...passed, ...override }], sha), "pending");
  }
  assert.equal(assessRuns([], sha), "pending");
  for (const conclusion of [
    "failure",
    "cancelled",
    "skipped",
    "neutral",
    "timed_out",
    null,
  ]) {
    assert.equal(assessRuns([{ ...passed, conclusion }], sha), "failure");
  }
});
test("a rerun or newer run supersedes an older successful result", () => {
  for (const override of [{ run_attempt: 2 }, { run_number: 2 }]) {
    const newer = {
      ...passed,
      ...override,
      status: "in_progress",
      conclusion: null,
    };
    assert.equal(assessRuns([passed, newer], sha), "pending");
    assert.equal(
      assessRuns(
        [passed, { ...newer, status: "completed", conclusion: "failure" }],
        sha,
      ),
      "failure",
    );
  }
});
