import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Budget, LIMIT, reservation } from "../code-review/budget.mjs";
import { changedLines, Snapshot, sourcePath } from "../code-review/context.mjs";
import { ReviewerModel } from "../code-review/model.mjs";
import { markdown, review } from "../code-review/review.mjs";
import { command } from "../core.mjs";

async function temp(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "peekareq-code-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test("context follows global guards, late imports and actual query definitions ahead of imports", async (t) => {
  const dir = await temp(t);
  const git = (...args) => command("git", args, { cwd: dir });
  const put = async (file, text) => {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), text);
  };
  await git("init", "-q");
  await git("config", "user.name", "Test");
  await git("config", "user.email", "test@example.invalid");
  await put(
    "apps/api/src/index.ts",
    'import { authenticateRequest } from "./utils/authenticate-request";\nimport integration from "./integration";\napi.use("*", authenticateRequest);\napi.route("/integration", integration);',
  );
  await put(
    "apps/api/src/utils/authenticate-request.ts",
    'export function authenticateRequest(c) { if (!c.user) throw Error("Unauthorized"); }',
  );
  await put(
    "apps/api/src/integration/controllers/list-repos.ts",
    `export function listRepos() {\n${"// Context before the data access\n".repeat(95)}return sharedApp.allInstallations();\n}`,
  );
  const imports = Array.from(
    { length: 13 },
    (_, i) => `import dependency${i} from "./unused${i}";`,
  ).join("\n");
  const route = `${imports}\nimport { listRepos } from "./controllers/list-repos";\n${"// Route definitions preceding the handler\n".repeat(500)}const integration = api.get("/repositories", requireWorkspace, () => listRepos());`;
  await put("apps/api/src/integration/index.ts", route);
  await put(
    "apps/web/src/hooks/mutations/set-value.ts",
    'function setValue() { invalidate({queryKey: ["custom-values", taskId]}); }',
  );
  for (let i = 0; i < 12; i++)
    await put(
      `apps/web/src/components/noise${i}.tsx`,
      'import values from "./custom-values";',
    );
  await put(
    "apps/web/src/hooks/queries/project.ts",
    'useQuery({queryKey: ["custom-values", projectId]});',
  );
  await put(
    "tests/business-behavior.test.ts",
    'import { listRepos } from "../apps/api/src/integration/controllers/list-repos";\n' +
      "// Fixture setup\n".repeat(200) +
      'it("keeps repositories private", () => listRepos());',
  );
  await git("add", ".");
  await git("commit", "-qm", "base");
  const base = await git("rev-parse", "HEAD");
  await put(
    "apps/api/src/integration/index.ts",
    route.replace("requireWorkspace, ", ""),
  );
  await put(
    "apps/web/src/hooks/mutations/set-value.ts",
    'function setValue() { invalidate({queryKey: ["custom-values"]}); }',
  );
  await git("add", ".");
  await git("commit", "-qm", "head");
  const head = await git("rev-parse", "HEAD");
  const packet = await new Snapshot(dir, base, head).collect();
  const controllerPacket = await new Snapshot(dir, base, head).collect({
    files: ["apps/api/src/integration/controllers/list-repos.ts"],
  });
  assert.ok(
    controllerPacket.testIndex.some(
      (entry) =>
        entry.path === "tests/business-behavior.test.ts" &&
        entry.tests.some(
          (test) =>
            test.line === 202 &&
            test.text.includes("keeps repositories private"),
        ),
    ),
  );
  assert.ok(
    controllerPacket.boundaries.some(
      (c) =>
        c.path.endsWith("integration/index.ts") &&
        c.text.includes('api.get("/repositories"'),
    ),
  );
  assert.ok(
    packet.boundaries.some(
      (c) =>
        c.path.endsWith("src/index.ts") &&
        c.text.includes('api.use("*", authenticateRequest)'),
    ),
  );
  assert.ok(
    packet.boundaries.some(
      (c) =>
        c.path.endsWith("list-repos.ts") &&
        c.text.includes("sharedApp.allInstallations"),
    ),
  );
  assert.ok(
    packet.boundaries.some(
      (c) =>
        c.path.endsWith("queries/project.ts") &&
        c.text.includes('"custom-values", projectId'),
    ),
  );
});

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
  await assert.rejects(model.ask("test", {}, "investigate"), /timeout/);
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
              message: { content: '{"findings":[],"requests":[]}' },
            },
          ],
        }),
      };
    },
  });
  await model.ask("prompt", {}, "investigate");
  await model.ask("prompt", {}, "investigate");
  assert.equal(sent, 1);
  assert.equal(model.calls[1].billedNow, 0);
  await assert.rejects(model.ask("different", {}, "investigate"), /Incomplete/);
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

test("a head finding is withheld when its behavior already exists in base", async () => {
  const report = await review(
    { ...snapshot, read: async () => "return value;" },
    {
      calls: [],
      ask: async (_system, input, label) => {
        if (label === "investigate")
          return { findings: [structuredClone(candidate)] };
        if (label === "verify")
          return {
            decisions: [
              {
                id: "one",
                verdict: "keep",
                reason: "Claimed regression",
                disproofChecked: "Caller checked",
                evidence: [ref],
                contract: ref,
              },
            ],
          };
        assert.equal(label, "base-behavior");
        assert.equal(input.diff, undefined);
        assert.ok(input.context.every((c) => c.revision === "base"));
        assert.deepEqual(Object.keys(input.questions[0]).sort(), [
          "actual",
          "id",
          "trigger",
        ]);
        return {
          checks: [
            {
              id: "one",
              alreadyPresent: "yes",
              reason: "The same mutation handler already lacks a redirect",
              evidence: [{ ...ref, revision: "base" }],
            },
          ],
        };
      },
    },
  );
  assert.equal(report.findings.length, 0);
  assert.equal(report.rejected.at(-1).verdict, "pre-existing");
});

test("the removed implementation alone cannot establish the expected product contract", async () => {
  let calls = 0;
  const report = await review(
    { ...snapshot, read: async () => "return changed;" },
    {
      calls: [],
      ask: async (_system, input) => {
        calls++;
        if (calls === 2)
          assert.match(input.candidates[0].contractProblem, /independent/);
        return calls === 1
          ? {
              findings: [
                { ...candidate, contract: { ...ref, revision: "base" } },
              ],
            }
          : {
              decisions: [
                {
                  id: "one",
                  verdict: "keep",
                  reason: "Old behavior",
                  disproofChecked: "No evidence",
                  evidence: [ref],
                  contract: { ...ref, revision: "base" },
                },
              ],
            };
      },
    },
  );
  assert.equal(report.findings.length, 0);
});

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

test("malformed model fields are billed but never cached or reported as clean reviews", async (t) => {
  const dir = await temp(t);
  const budget = new Budget(path.join(dir, "budget.json"));
  const model = new ReviewerModel({
    key: "test",
    cache: path.join(dir, "responses"),
    budget,
    fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.strict, true);
      return Response.json({
        model: "test-model",
        usage: { cost: 0.001 },
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                findings: [{ ...candidate, tite: "Typo" }],
                requests: [],
              }),
            },
          },
        ],
      });
    },
  });
  const report = await review(
    {
      ...snapshot,
      packets: async function* () {
        yield packet;
      },
    },
    model,
  );
  assert.equal(report.status, "inconclusive");
  assert.equal(report.failure, "invalid-model-response");
  assert.equal(report.findings.length, 0);
  assert.equal(report.cost, 0.001);
  assert.equal((await budget.status()).reported, 0.001);
});

test("uncertain source evidence marks packet coverage partial", async () => {
  const report = await review(
    {
      ...snapshot,
      packets: async function* () {
        yield packet;
      },
    },
    {
      calls: [],
      ask: async () => ({
        findings: [{ ...candidate, path: "unrelated.ts" }],
        requests: [],
      }),
    },
  );
  assert.equal(report.status, "partial");
  assert.equal(report.findings.length, 0);
});

test("expired reviews stop before reserving or sending another model request", async (t) => {
  const dir = await temp(t);
  const budget = new Budget(path.join(dir, "budget.json"));
  const model = new ReviewerModel({
    key: "test",
    cache: dir,
    budget,
    deadline: 0,
    fetcher: async () => {
      throw Error("Must not call");
    },
  });
  await assert.rejects(model.ask("prompt", {}, "investigate"), /deadline/);
  assert.equal((await budget.status()).calls, 0);
});

test("citations accept literal source-line fragments but reject changed or ambiguous text", async () => {
  const s = new Snapshot("unused", "a".repeat(40), "b".repeat(40));
  const source =
    'it("keeps the original assignment", async () => {\n  expect(remove).not.toHaveBeenCalled();\n});';
  s.read = async () => source;
  const fragment = {
    path: "behavior.test.ts",
    line: 99,
    quote: 'it("keeps the original assignment"',
    revision: "head",
  };
  assert.deepEqual(await s.resolveCitation(fragment), {
    ...fragment,
    line: 1,
    quote: source.split("\n")[0],
  });
  assert.equal(
    await s.resolveCitation({
      ...fragment,
      quote: 'it("removes the original assignment"',
    }),
    false,
  );
  s.read = async () => `${source}\n${source}`;
  assert.equal(await s.resolveCitation(fragment), false);
});
