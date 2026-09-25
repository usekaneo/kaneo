import assert from "node:assert/strict";
import test from "node:test";
import { commentBody, MARKER, publishReview } from "../code-review/publish.mjs";

const report = {
  pr: 1735,
  head: "a".repeat(40),
  base: "b".repeat(40),
  targetBase: "c".repeat(40),
  status: "reviewed",
  findings: [],
  calls: [{ model: "test/model" }],
  cost: 0.001,
  costKnown: true,
  startedAt: "2026-09-17T00:00:00Z",
  finishedAt: "2026-09-17T00:00:20Z",
  coverage: { omitted: [] },
};
const options = {
  actor: "peekareq[bot]",
  eventName: "workflow_dispatch",
  event: {
    repository: { full_name: "usekaneo/kaneo" },
    sender: { type: "User", login: "maintainer" },
    inputs: { pr: "1735" },
  },
};
function mock({
  head = report.head,
  base = report.targetBase,
  permission = "write",
  existing = true,
} = {}) {
  const writes = [];
  const api = async (endpoint, request) => {
    if (request) {
      writes.push({ endpoint, ...request });
      return { html_url: "https://example.test/comment" };
    }
    if (endpoint.endsWith("/permission")) return { permission };
    if (endpoint.endsWith("/pulls/1735"))
      return {
        state: "open",
        head: { sha: head },
        base: { sha: base, repo: { full_name: "usekaneo/kaneo" } },
      };
    if (endpoint.includes("/comments?"))
      return [
        { id: 1, user: { login: "outsider" }, body: MARKER },
        ...(existing
          ? [{ id: 2, user: { login: "peekareq[bot]" }, body: MARKER }]
          : []),
      ];
    throw new Error(`Unexpected endpoint ${endpoint}`);
  };
  return { writes, api };
}

test("publisher updates only its own code-review comment", async () => {
  const s = mock();
  await publishReview(report, options, s.api);
  assert.equal(s.writes.length, 1);
  assert.equal(s.writes[0].method, "PATCH");
  assert.ok(s.writes[0].endpoint.endsWith("/comments/2"));
  const fresh = mock({ existing: false });
  await publishReview(report, options, fresh.api);
  assert.equal(fresh.writes[0].method, "POST");
});

test("stale head, stale base, revoked access and unexpected actors cannot publish", async () => {
  for (const changes of [
    { head: "d".repeat(40) },
    { base: "e".repeat(40) },
    { permission: "read" },
  ]) {
    const s = mock(changes);
    await assert.rejects(publishReview(report, options, s.api));
    assert.equal(s.writes.length, 0);
  }
  await assert.rejects(
    publishReview(report, { ...options, actor: "other[bot]" }, mock().api),
  );
});

test("partial reviews are visible and model prose cannot inject HTML or mentions", () => {
  const body = commentBody({
    ...report,
    status: "partial",
    findings: [
      {
        path: "apps/api/src/index.ts",
        line: 5,
        severity: "high",
        title: "<script>@everyone</script>",
        trigger: "[click](https://evil.test)",
        actual: "<!-- hidden -->",
      },
    ],
  });
  assert.ok(body.includes("Review incomplete"));
  assert.ok(body.includes("<summary>Findings (Beta)</summary>"));
  assert.ok(body.includes("<summary>Run info</summary>"));
  assert.ok(!body.includes("<script>"));
  assert.ok(!body.includes("@everyone"));
  assert.ok(body.includes(`/blob/${report.head}/apps/api/src/index.ts#L5`));
  assert.ok(body.includes("$0.00100"));
});
