import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { classifyBrowserStack } from "./browserstack-change-classification.mjs";

const sha = (char) => char.repeat(40);
const now = Date.parse("2026-10-24T12:00:00Z");
const push = {
  ref: "refs/heads/main",
  after: sha("b"),
  before: sha("a"),
  forced: false,
  deleted: false,
  repository: { full_name: "owner/repo" },
};
const base = {
  eventName: "push",
  ref: "refs/heads/main",
  sha: sha("b"),
  runId: "20",
  runAttempt: "1",
  event: push,
  repository: "owner/repo",
  token: "secret",
  now,
};
function response(value, status = 200) {
  return Response.json(value, { status });
}
function run(overrides = {}) {
  return {
    id: 10,
    run_number: 10,
    run_attempt: 1,
    name: "BrowserStack",
    event: "push",
    status: "completed",
    conclusion: "success",
    head_branch: "main",
    head_sha: sha("a"),
    path: ".github/workflows/browserstack.yml",
    repository: { full_name: "owner/repo" },
    head_repository: { full_name: "owner/repo" },
    ...overrides,
  };
}
function jobs(
  id = 10,
  attempt = 1,
  steps = [
    {
      name: "Run browser smoke tests",
      status: "completed",
      conclusion: "success",
      completed_at: new Date(now - 60_000).toISOString(),
    },
  ],
  overrides = {},
) {
  return {
    total_count: 1,
    jobs: [
      {
        id: 99,
        run_id: id,
        run_attempt: attempt,
        head_sha: sha("a"),
        status: "completed",
        conclusion: "success",
        name: "smoke",
        steps,
        ...overrides,
      },
    ],
  };
}
function neutralJobs(id, attempt) {
  return jobs(
    id,
    attempt,
    [
      {
        name: "Classify BrowserStack changes",
        status: "completed",
        conclusion: "success",
        completed_at: new Date(now - 30_000).toISOString(),
      },
      {
        name: "Run browser smoke tests",
        status: "completed",
        conclusion: "skipped",
        completed_at: null,
      },
    ],
    { conclusion: "success", head_sha: sha("b") },
  );
}
function fakeApi({
  runs = [run()],
  compare = {
    status: "ahead",
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    base_commit: { sha: sha("a") },
    merge_base_commit: { sha: sha("a") },
    commits: [{ sha: sha("b") }],
    files: [{ filename: "docs/page.md", status: "modified" }],
  },
  jobsById = new Map([[10, jobs()]]),
  mutate = () => {},
} = {}) {
  return async (url, options = {}) => {
    mutate(url);
    assert.equal(options.redirect, "error");
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://api.github.com");
    if (parsed.pathname.endsWith("/actions/workflows/browserstack.yml/runs"))
      return response({ total_count: runs.length, workflow_runs: runs });
    const jobMatch = parsed.pathname.match(
      /\/actions\/runs\/(\d+)\/attempts\/(\d+)\/jobs$/,
    );
    if (jobMatch)
      return response(
        jobsById.get(Number(jobMatch[1])) ??
          jobs(Number(jobMatch[1]), Number(jobMatch[2])),
      );
    if (parsed.pathname.includes("/compare/")) return response(compare);
    throw new Error(`Unexpected route: ${parsed.pathname}`);
  };
}

test("fresh successful full baseline + complete docs/site/sponsor diff skips", async () => {
  assert.deepEqual(
    await classifyBrowserStack({ ...base, request: fakeApi() }),
    { skip: true, reason: "validated-neutral-changes", baselineSha: sha("a") },
  );
});

test("runtime/config/lock/mixed/hidden changes and unsafe rename run full", async () => {
  for (const filename of [
    "apps/api/main.ts",
    "package.json",
    "pnpm-lock.yaml",
    "apps/site/.npmrc",
    "apps/site/constants/other.json",
  ]) {
    const compare = {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      base_commit: { sha: sha("a") },
      merge_base_commit: { sha: sha("a") },
      commits: [{ sha: sha("b") }],
      files: [{ filename, status: "modified" }],
    };
    assert.equal(
      (await classifyBrowserStack({ ...base, request: fakeApi({ compare }) }))
        .skip,
      false,
      filename,
    );
  }
  for (const file of [
    { filename: "docs/a.md", status: "renamed" },
    {
      filename: "docs/a.md",
      previous_filename: "apps/api/a.md",
      status: "renamed",
    },
    { filename: "docs/a.md", status: "copied" },
  ]) {
    const compare = {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      base_commit: { sha: sha("a") },
      merge_base_commit: { sha: sha("a") },
      commits: [{ sha: sha("b") }],
      files: [file],
    };
    assert.equal(
      (await classifyBrowserStack({ ...base, request: fakeApi({ compare }) }))
        .skip,
      false,
    );
  }
});

test("manual/scheduled/rerun/forced/missing/malformed contexts run full without API", async () => {
  for (const ctx of [
    { eventName: "workflow_dispatch" },
    { eventName: "schedule" },
    { runAttempt: "2" },
    { ref: "refs/heads/other" },
    { event: { ...push, forced: true } },
    { event: { ...push, deleted: true } },
    { event: { ...push, after: "bad" } },
    { event: { ...push, repository: {} } },
    { runId: "bad" },
  ])
    assert.equal(
      (
        await classifyBrowserStack({
          ...base,
          ...ctx,
          request: async () => {
            throw Error("unexpected API");
          },
        })
      ).skip,
      false,
      JSON.stringify(ctx),
    );
});

test("prior cheap green run does not refresh full validation clock", async () => {
  const neutral = run({ id: 11, head_sha: sha("b") });
  const stale = jobs(10, 1, [
    {
      name: "Run browser smoke tests",
      status: "completed",
      conclusion: "success",
      completed_at: new Date(now - 86_400_000).toISOString(),
    },
  ]);
  const api = fakeApi({
    runs: [neutral, run()],
    jobsById: new Map([
      [11, neutralJobs(11, 1)],
      [10, stale],
    ]),
  });
  assert.equal(
    (await classifyBrowserStack({ ...base, request: api })).skip,
    false,
  );
});

test("a cheap green run can lead to a fresh actual full baseline", async () => {
  const neutral = run({ id: 11, head_sha: sha("b") });
  const request = fakeApi({
    runs: [neutral, run()],
    jobsById: new Map([
      [11, neutralJobs(11, 1)],
      [10, jobs()],
    ]),
  });
  assert.equal((await classifyBrowserStack({ ...base, request })).skip, true);
});

test("real bare workflow paths and exact main-ref paths both identify full proof", async () => {
  for (const path of [
    ".github/workflows/browserstack.yml",
    ".github/workflows/browserstack.yml@refs/heads/main",
  ])
    assert.equal(
      (
        await classifyBrowserStack({
          ...base,
          request: fakeApi({ runs: [run({ path })] }),
        })
      ).skip,
      true,
      path,
    );
});

test("cancelled scheduled and failed manual runs force a replacement full run", async () => {
  const path = ".github/workflows/browserstack.yml@refs/heads/main";
  for (const event of ["schedule", "workflow_dispatch"])
    for (const conclusion of ["cancelled", "failure"])
      assert.equal(
        (
          await classifyBrowserStack({
            ...base,
            request: fakeApi({
              runs: [run({ id: 11, event, conclusion, path }), run({ path })],
            }),
          })
        ).skip,
        false,
        `${event}:${conclusion}`,
      );
});

test("mismatched push ref and non-numeric run identity cannot authorize a skip", async () => {
  for (const context of [
    { event: { ...push, ref: "refs/heads/other" } },
    { runId: true },
    { runAttempt: true },
  ]) {
    const request = fakeApi({
      runs: [
        run({ path: ".github/workflows/browserstack.yml@refs/heads/main" }),
      ],
    });
    assert.equal(
      (await classifyBrowserStack({ ...base, ...context, request })).skip,
      false,
    );
  }
});

test("inconsistent ahead count and explicit truncation stay full", async () => {
  const compare = {
    status: "ahead",
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    base_commit: { sha: sha("a") },
    merge_base_commit: { sha: sha("a") },
    commits: [{ sha: sha("b") }],
    files: [{ filename: "docs/a.md", status: "modified" }],
  };
  for (const change of [
    { ahead_by: 2 },
    { truncated: true },
    { incomplete_results: true },
  ]) {
    const request = fakeApi({
      runs: [
        run({ path: ".github/workflows/browserstack.yml@refs/heads/main" }),
      ],
      compare: { ...compare, ...change },
    });
    assert.equal(
      (await classifyBrowserStack({ ...base, request })).skip,
      false,
    );
  }
});

test("a missing HTTP status cannot authorize a skip", async () => {
  const api = fakeApi({
    runs: [run({ path: ".github/workflows/browserstack.yml@refs/heads/main" })],
  });
  const request = async (...args) => {
    const result = await api(...args);
    return { redirected: false, json: () => result.json() };
  };
  assert.equal((await classifyBrowserStack({ ...base, request })).skip, false);
});

test("manual and scheduled full validations can supply the actual baseline", async () => {
  for (const event of ["workflow_dispatch", "schedule"]) {
    const comparison = {
      status: "ahead",
      ahead_by: 1,
      behind_by: 0,
      total_commits: 1,
      base_commit: { sha: sha("c") },
      merge_base_commit: { sha: sha("c") },
      commits: [{ sha: sha("b") }],
      files: [{ filename: "docs/a.md", status: "modified" }],
    };
    const request = fakeApi({
      runs: [run({ id: 11, event, head_sha: sha("c") }), run()],
      jobsById: new Map([[11, jobs(11, 1, undefined, { head_sha: sha("c") })]]),
      compare: comparison,
    });
    const result = await classifyBrowserStack({ ...base, request });
    assert.equal(result.skip, true);
    assert.equal(result.baselineSha, sha("c"));
  }
});

test("older run-history pages are unnecessary after complete immutable source proof", async () => {
  const records = [
    run({ id: 10000, created_at: new Date(now - 120_000).toISOString() }),
    ...Array.from({ length: 19 }, (_, index) =>
      run({
        id: 9999 - index,
        conclusion: "cancelled",
        created_at: new Date(now - 180_000 - index * 60_000).toISOString(),
      }),
    ),
  ];
  const api = fakeApi({
    runs: records,
    jobsById: new Map([[10000, jobs(10000)]]),
  });
  const request = async (url, options) => {
    const result = await api(url, options);
    if (new URL(url).pathname.endsWith("/runs")) {
      const history = await result.json();
      return response({ ...history, total_count: 2000 });
    }
    return result;
  };
  assert.equal(
    (await classifyBrowserStack({ ...base, runId: "10001", request })).skip,
    true,
  );
});

test("cancelled or failed latest attempt makes evidence uncertain and runs full", async () => {
  for (const conclusion of ["cancelled", "failure"]) {
    const latest = run({ id: 11, head_sha: sha("b"), conclusion });
    assert.equal(
      (
        await classifyBrowserStack({
          ...base,
          request: fakeApi({ runs: [latest, run()] }),
        })
      ).skip,
      false,
      conclusion,
    );
  }
});

test("old, missing, future and exactly-24-hour baseline time run full", async () => {
  for (const completedAt of [
    new Date(now - 86_400_001).toISOString(),
    new Date(now - 86_400_000).toISOString(),
    new Date(now + 1).toISOString(),
    null,
  ]) {
    const proof = jobs(10, 1, [
      {
        name: "Run browser smoke tests",
        status: "completed",
        conclusion: "success",
        completed_at: completedAt,
      },
    ]);
    assert.equal(
      (
        await classifyBrowserStack({
          ...base,
          request: fakeApi({ jobsById: new Map([[10, proof]]) }),
        })
      ).skip,
      false,
      String(completedAt),
    );
  }
});

test("API denial, malformed responses, incomplete or mismatched job and exhausted history run full", async () => {
  for (const request of [
    async () => response({}, 403),
    async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad JSON");
      },
    }),
  ])
    assert.equal(
      (await classifyBrowserStack({ ...base, request })).skip,
      false,
    );
  const cases = [
    { jobsById: new Map([[10, { total_count: 1, jobs: [] }]]) },
    { jobsById: new Map([[10, jobs(11, 1)]]) },
    { jobsById: new Map([[10, jobs(10, 2)]]) },
    {
      runs: Array.from({ length: 20 }, (_, i) =>
        run({ id: 100 + i, conclusion: "skipped" }),
      ),
    },
    { runs: [run({ path: ".github/workflows/other.yml@refs/heads/main" })] },
    { runs: [run({ head_repository: { full_name: "fork/repo" } })] },
  ];
  for (const input of cases)
    assert.equal(
      (await classifyBrowserStack({ ...base, request: fakeApi(input) })).skip,
      false,
    );
});

test("CLI emits explicit false and exits successfully for manual/schedule fallbacks without network", async () => {
  for (const eventName of ["workflow_dispatch", "schedule"]) {
    const directory = await mkdtemp(join(tmpdir(), "browserstack-cli-"));
    try {
      const eventPath = join(directory, "event.json");
      const outputPath = join(directory, "output.txt");
      await writeFile(eventPath, JSON.stringify({}));
      const child = spawnSync(
        process.execPath,
        [
          fileURLToPath(
            new URL(
              "./browserstack-change-classification.mjs",
              import.meta.url,
            ),
          ),
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: eventName,
            GITHUB_REF: "refs/heads/main",
            GITHUB_SHA: sha("b"),
            GITHUB_RUN_ID: "20",
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "owner/repo",
            GITHUB_OUTPUT: outputPath,
          },
        },
      );
      assert.equal(child.status, 0, child.stderr);
      assert.equal(
        await readFile(outputPath, "utf8"),
        "skip_browserstack=false\n",
      );
      assert.match(child.stdout, /full-validation/);
      assert.match(child.stdout, /non-qualifying-context/);
    } finally {
      await rm(directory, { recursive: true });
    }
  }
});

test("CLI reports fallback reasons while keeping credentials and payloads private", async () => {
  const token = "TOKEN_FIXTURE_MUST_STAY_PRIVATE";
  const payload = "API_PAYLOAD_FIXTURE_MUST_STAY_PRIVATE";
  const errorText = JSON.stringify(`${token} ${payload}`);
  const cases = [
    {
      name: "API rejection",
      preload: `globalThis.fetch = async () => { throw new Error(${errorText}); };`,
      reason: "api-or-budget-error",
    },
    {
      name: "request timeout",
      preload: `globalThis.fetch = async () => { throw new DOMException(${errorText}, "TimeoutError"); };`,
      reason: "api-or-budget-error",
    },
    {
      name: "invalid API JSON",
      preload: `globalThis.fetch = async () => new Response(${JSON.stringify(payload)}, { status: 200 });`,
      reason: "api-or-budget-error",
    },
    {
      name: "missing token",
      preload: `globalThis.fetch = async () => { throw new Error(${errorText}); };`,
      token: "",
      reason: "insufficient-evidence",
    },
    {
      name: "invalid event JSON",
      preload: `globalThis.fetch = async () => { throw new Error(${errorText}); };`,
      event: payload,
      reason: "invalid-event",
    },
  ];
  for (const scenario of cases) {
    const directory = await mkdtemp(join(tmpdir(), "browserstack-log-cli-"));
    try {
      const eventPath = join(directory, "event.json");
      const outputPath = join(directory, "output.txt");
      const preloadPath = join(directory, "preload.mjs");
      await writeFile(eventPath, scenario.event ?? JSON.stringify(push));
      await writeFile(preloadPath, scenario.preload);
      const child = spawnSync(
        process.execPath,
        [
          "--import",
          preloadPath,
          fileURLToPath(
            new URL(
              "./browserstack-change-classification.mjs",
              import.meta.url,
            ),
          ),
        ],
        {
          encoding: "utf8",
          timeout: 15_000,
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: "push",
            GITHUB_REF: "refs/heads/main",
            GITHUB_SHA: sha("b"),
            GITHUB_RUN_ID: "20",
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: "owner/repo",
            GITHUB_TOKEN: scenario.token ?? token,
            GITHUB_OUTPUT: outputPath,
          },
        },
      );
      assert.equal(child.status, 0, `${scenario.name}: ${child.stderr}`);
      assert.equal(
        await readFile(outputPath, "utf8"),
        "skip_browserstack=false\n",
        scenario.name,
      );
      assert.match(child.stdout, /full-validation/, scenario.name);
      assert.ok(
        child.stdout.includes(scenario.reason),
        `${scenario.name}: missing fallback reason`,
      );
      const logs = child.stdout + child.stderr;
      assert.ok(!logs.includes(token), `${scenario.name}: token leaked`);
      assert.ok(
        !logs.includes(payload),
        `${scenario.name}: response payload leaked`,
      );
    } finally {
      await rm(directory, { recursive: true });
    }
  }
});

test("comparison divergence, incorrect revision/count, 300 files and empty files run full", async () => {
  const valid = {
    status: "ahead",
    ahead_by: 1,
    behind_by: 0,
    total_commits: 1,
    base_commit: { sha: sha("a") },
    merge_base_commit: { sha: sha("a") },
    commits: [{ sha: sha("b") }],
    files: [{ filename: "docs/a.md", status: "modified" }],
  };
  const cases = [
    { ...valid, status: "diverged", behind_by: 1 },
    { ...valid, base_commit: { sha: sha("c") } },
    { ...valid, merge_base_commit: { sha: sha("c") } },
    { ...valid, total_commits: 251 },
    { ...valid, total_commits: 2 },
    { ...valid, commits: [{ sha: sha("c") }] },
    {
      ...valid,
      files: Array.from({ length: 300 }, () => ({
        filename: "docs/a.md",
        status: "modified",
      })),
    },
    { ...valid, files: [] },
    {
      ...valid,
      files: [
        {
          filename: "docs/a.md",
          status: "added",
          previous_filename: "apps/api/a",
        },
      ],
    },
  ];
  for (const compare of cases)
    assert.equal(
      (await classifyBrowserStack({ ...base, request: fakeApi({ compare }) }))
        .skip,
      false,
    );
});
