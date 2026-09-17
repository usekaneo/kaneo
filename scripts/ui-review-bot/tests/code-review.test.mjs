import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Budget, LIMIT, reservation } from "../code-review/budget.mjs";
import { changedLines, Snapshot, sourcePath } from "../code-review/context.mjs";
import { ReviewerModel } from "../code-review/model.mjs";
import { probeRevision, validProbe } from "../code-review/probe.mjs";
import { markdown, review } from "../code-review/review.mjs";
import { score } from "../code-review/score.mjs";

async function temp(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "peekareq-code-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("budget persists across processes, reserves before calls, and refuses overspend", async (t) => {
  const file = path.join(await temp(t), "budget.json");
  const first = new Budget(file);
  const id = await first.reserve(0.8, "test");
  const second = new Budget(file);
  await assert.rejects(second.reserve(0.06, "over"), /Budget exhausted/);
  await second.settle(id, { cost: 0.1 }, "test-model");
  assert.equal((await first.status()).reported, 0.1);
  assert.equal((await first.status()).committed, 0.1 * 1.15);
  await assert.rejects(first.settle(id, { cost: 0 }, "again"), /settled/);
  assert.equal(JSON.parse(await readFile(file)).limit, LIMIT);
});

test("unknown costs stay reserved and excess provider costs halt further requests", async (t) => {
  const budget = new Budget(path.join(await temp(t), "budget.json"));
  const a = await budget.reserve(0.1, "unknown");
  await budget.settle(a, {}, "model");
  assert.equal((await budget.status()).committed, 0.1);
  const b = await budget.reserve(0.1, "over-priced");
  await budget.settle(b, { cost: 0.2 }, "model");
  assert.equal((await budget.status()).halted, true);
  await assert.rejects(budget.reserve(0.01, "denied"), /halted/);
});

test("concurrent calls cannot race past the shared cap", async (t) => {
  const file = path.join(await temp(t), "budget.json");
  const results = await Promise.allSettled([
    new Budget(file).reserve(0.6, "a"),
    new Budget(file).reserve(0.6, "b"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await new Budget(file).status()).committed, 0.6);
});

test("model errors keep reservations and never retry implicitly", async (t) => {
  const dir = await temp(t);
  const budget = new Budget(path.join(dir, "budget.json"));
  let sent = 0;
  const model = new ReviewerModel({
    key: "test",
    cache: dir,
    budget,
    fetcher: async (_url, options) => {
      sent++;
      const request = JSON.parse(options.body);
      assert.equal(request.provider.max_price.request, 0);
      assert.equal(request.provider.require_parameters, true);
      assert.equal(request.max_tokens, 8192);
      assert.ok((await budget.status()).committed > 0);
      throw new Error("Network timeout");
    },
  });
  await assert.rejects(model.ask("test", {}, "test"), /timeout/);
  assert.equal(sent, 1);
  assert.equal((await budget.status()).unknown, 1);
  assert.ok(reservation([{ content: "Ä🙂" }], 4096) > 0);
});

test("cached model results cost zero new dollars and truncated outputs never become reviews", async (t) => {
  const dir = await temp(t);
  const budget = new Budget(path.join(dir, "budget.json"));
  let sent = 0;
  const model = new ReviewerModel({
    key: "test",
    cache: path.join(dir, "cache"),
    budget,
    fetcher: async () => {
      sent++;
      return {
        ok: true,
        json: async () => ({
          model: "served",
          usage: { cost: 0.001 },
          choices: [
            {
              finish_reason: sent === 1 ? "stop" : "length",
              message: { content: '{"findings":[]}' },
            },
          ],
        }),
      };
    },
  });
  await model.ask("prompt", {}, "one");
  await model.ask("prompt", {}, "same");
  assert.equal(sent, 1);
  assert.equal(model.calls[1].billedNow, 0);
  await assert.rejects(model.ask("different", {}, "truncated"), /Incomplete/);
  assert.equal((await budget.status()).reported, 0.002);
});

test("diff anchors track additions and deletions; source lookup excludes sensitive paths", () => {
  assert.deepEqual(
    changedLines("@@ -8,2 +8,3 @@\n unchanged\n-old\n+new\n+added"),
    [9, 10],
  );
  for (const name of [
    "../x.ts",
    "/x.ts",
    "x.ts\n",
    "keys.pem",
    ".env",
    "secrets.json",
    "a\\b.ts",
  ])
    assert.equal(sourcePath(name), false);
  assert.equal(sourcePath("apps/api/src/auth.ts"), true);
});

const ref = {
  path: "app.ts",
  line: 10,
  quote: "return value;",
  revision: "head",
};
const candidate = {
  id: "one",
  title: "Concrete failure",
  severity: "high",
  category: "data",
  path: "app.ts",
  line: 10,
  trigger: "A specific input",
  expected: "A supported result",
  actual: "A different result",
  introducedBy: "Changed return value",
  evidence: [ref],
  contract: ref,
};
const packet = {
  changed: [{ path: "app.ts", lines: [10], patch: "+return value;" }],
  omitted: [],
  coverage: "Partial context",
};
const snapshot = {
  base: "a".repeat(40),
  head: "b".repeat(40),
  collect: async () => packet,
  citation: async (r) => r?.quote === ref.quote,
  lookup: async () => [],
};

test("source-invalid and off-diff findings never reach the verifier", async () => {
  let calls = 0;
  const report = await review(snapshot, {
    calls: [],
    ask: async () => {
      calls++;
      return {
        findings: [
          { ...candidate, path: "unrelated.ts" },
          { ...candidate, evidence: [{ ...ref, quote: "invented" }] },
        ],
      };
    },
  });
  assert.equal(calls, 1);
  assert.equal(report.findings.length, 0);
  assert.equal(report.rejected.length, 2);
});

test("verifier must provide counterevidence checks and valid citations, not confidence scores", async () => {
  for (const verdict of ["reject", "uncertain", "keep"]) {
    let n = 0;
    const report = await review(snapshot, {
      calls: [],
      ask: async () =>
        ++n === 1
          ? { findings: [candidate] }
          : {
              decisions: [
                {
                  id: "one",
                  verdict,
                  reason: "Checked route",
                  disproofChecked: "",
                  evidence: [ref],
                  contract: ref,
                },
              ],
            },
    });
    assert.equal(report.findings.length, 0);
  }
  let n = 0;
  const report = await review(snapshot, {
    calls: [],
    ask: async () =>
      ++n === 1
        ? { findings: [candidate] }
        : {
            decisions: [
              {
                id: "one",
                verdict: "keep",
                reason: "Checked route",
                disproofChecked: "No caller guard handles this input",
                evidence: [ref],
                contract: ref,
              },
            ],
          },
  });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].evidenceLevel, "code-path-reviewed");
  report.findings[0].title = "</details>@everyone";
  assert.ok(!markdown(report).includes("</details>@everyone"));
});

test("requested context is explored even when the first pass has no findings", async () => {
  let n = 0;
  const report = await review(
    {
      ...snapshot,
      lookup: async () => [{ path: "app.ts", start: 1, text: "source" }],
    },
    {
      calls: [],
      ask: async () => {
        n++;
        return {
          findings: [],
          requests: n === 1 ? [{ kind: "symbol", value: "guard" }] : [],
        };
      },
    },
  );
  assert.equal(n, 2);
  assert.equal(report.findings.length, 0);
});

test("citations correct unique line offsets without accepting invented or ambiguous code", async () => {
  const s = new Snapshot("/unused", "a".repeat(40), "b".repeat(40));
  s.read = async () =>
    "first line\n  return value;\nlast line\nrepeat();\nrepeat();";
  assert.equal((await s.resolveCitation({ ...ref, line: 99 })).line, 2);
  assert.equal(
    (await s.resolveCitation({ ...ref, quote: "+  return value;", line: 99 }))
      .line,
    2,
  );
  assert.equal(
    await s.resolveCitation({ ...ref, quote: "-invented();", line: 99 }),
    false,
  );
  assert.equal(
    await s.resolveCitation({ ...ref, quote: "return invented;" }),
    false,
  );
  assert.equal(
    await s.resolveCitation({ ...ref, quote: "repeat();", line: 2 }),
    false,
  );
  assert.equal(
    (
      await s.resolveCitation({
        ...ref,
        quote: "first line\n  return value;",
        line: 1,
      })
    ).line,
    1,
  );
});

test("probes use a restricted container and never execute supplied test code on the host", async () => {
  const spec = {
    module: "a.ts",
    export: "identity",
    cases: [{ args: [1], expected: 1 }],
  };
  assert.equal(validProbe({ ...spec, module: "../../etc/passwd" }), false);
  let runs = 0;
  const result = await probeRevision(
    { read: async () => "export function identity(x:number){return x;}" },
    "b".repeat(40),
    spec,
    async (bin, args) => {
      assert.equal(bin, "docker");
      if (args[0] === "rm") return "";
      runs++;
      for (const flag of [
        "--network=none",
        "--read-only",
        "--cap-drop=ALL",
        "--user=65534:65534",
        "--pull=never",
      ])
        assert.ok(args.includes(flag));
      assert.ok(
        !args.some((a) => a.includes(".env") || a.includes("docker.sock")),
      );
      return '{"status":"executed","results":[{"matches":true,"actual":1}]}';
    },
  );
  assert.equal(result.status, "executed");
  assert.equal(runs, 1);
  const unsupported = await probeRevision(
    { read: async () => 'import fs from "node:fs";' },
    "b".repeat(40),
    spec,
    async () => {
      throw Error("must not run");
    },
  );
  assert.equal(unsupported.status, "unsupported");
});

test("evaluation cannot turn silence, failed reviews, or unjudged findings into a win", () => {
  const cases = [
    {
      id: "a",
      kind: "regression",
      status: "reviewed",
      findings: [{ id: "1" }, { id: "2" }],
    },
    { id: "b", kind: "regression", status: "inconclusive", findings: [] },
    { id: "c", kind: "control", status: "reviewed", findings: [{ id: "3" }] },
  ];
  const result = score(cases, {
    "a:1": {
      label: "known-regression",
      reason: "Verified same triggering input and failure",
    },
  });
  assert.equal(result.recall, 0.5);
  assert.equal(result.confirmedPrecision, 1 / 3);
  assert.equal(result.unjudged, 2);
  assert.equal(result.inconclusive, 1);
  assert.equal(result.completeAdjudication, false);
});
