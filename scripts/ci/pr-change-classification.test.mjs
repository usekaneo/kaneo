import test from "node:test";
import assert from "node:assert/strict";
import {
  assessGate,
  classifyChanges,
  getPrFiles,
} from "./pr-change-classification.mjs";

test("known GitHub modified-file status allows an allowlisted docs path", () => {
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: [{ filename: "apps/site/page.md", status: "modified" }],
      complete: true,
    }).skipExpensive,
    true,
  );
});

test("missing and unknown GitHub file statuses fail closed", () => {
  for (const file of [
    { filename: "apps/site/page.md" },
    { filename: "apps/site/page.md", status: "copied" },
  ]) {
    assert.equal(
      classifyChanges({
        eventName: "pull_request",
        files: [file],
        complete: true,
      }).skipExpensive,
      false,
      JSON.stringify(file),
    );
  }
});

test("hidden and environment configuration paths require full validation", () => {
  for (const path of [
    "apps/site/.npmrc",
    "apps/site/.nvmrc",
    "apps/site/.node-version",
    "apps/site/.env.production",
  ]) {
    assert.equal(
      classifyChanges({
        eventName: "pull_request",
        files: [path],
        complete: true,
      }).skipExpensive,
      false,
      path,
    );
  }
});

test("allowlisted sponsor data skips while nearby JSON configuration does not", () => {
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: ["apps/site/constants/sponsors.json"],
      complete: true,
    }).skipExpensive,
    true,
  );
  for (const path of [
    "apps/site/constants/other.json",
    "apps/site/data/sponsors.json",
  ]) {
    assert.equal(
      classifyChanges({
        eventName: "pull_request",
        files: [path],
        complete: true,
      }).skipExpensive,
      false,
      path,
    );
  }
});

test("only complete docs-only PR changes skip the expensive suites", () => {
  for (const path of [
    "README.md",
    "docs/guide.md",
    "apps/docs/page.mdx",
    "apps/site/index.tsx",
  ]) {
    assert.equal(
      classifyChanges({
        eventName: "pull_request",
        files: [path],
        complete: true,
      }).skipExpensive,
      true,
    );
  }
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: ["docs/a.md", "apps/api/index.ts"],
      complete: true,
    }).skipExpensive,
    false,
  );
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "apps/site/package.json",
    "apps/docs/vite.config.ts",
    "Dockerfile.kaneo",
    ".github/workflows/ci.yml",
    "apps/mobile/page.md",
  ]) {
    assert.equal(
      classifyChanges({
        eventName: "pull_request",
        files: [path],
        complete: true,
      }).skipExpensive,
      false,
      path,
    );
  }
});

test("rename endpoints are both classified and incomplete/unknown detection fails full", () => {
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: [
        {
          filename: "apps/site/new.md",
          previous_filename: "apps/api/old.md",
          status: "renamed",
        },
      ],
      complete: true,
    }).skipExpensive,
    false,
  );
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: [
        {
          filename: "apps/site/new.md",
          previous_filename: "docs/old.md",
          status: "renamed",
        },
      ],
      complete: true,
    }).skipExpensive,
    true,
  );
  assert.equal(
    classifyChanges({
      eventName: "pull_request",
      files: [{ filename: "apps/site/new.md", status: "renamed" }],
      complete: true,
    }).skipExpensive,
    false,
  );
  for (const input of [
    { eventName: "pull_request", files: [], complete: true },
    { eventName: "pull_request", files: ["README.md"], complete: false },
    { eventName: "pull_request", files: ["docs/a.md", null], complete: true },
    {
      eventName: "pull_request",
      files: ["docs/a.md"],
      complete: true,
      error: true,
    },
  ])
    assert.equal(classifyChanges(input).skipExpensive, false);
});

const expectedBase = "a".repeat(40);
const expectedHead = "b".repeat(40);

function prMetadata(changedFiles, overrides = {}) {
  return {
    base: { sha: expectedBase },
    head: { sha: expectedHead },
    changed_files: changedFiles,
    ...overrides,
  };
}

function apiResponse(value) {
  return Response.json(value);
}

function prApiUrl(input) {
  return new URL(input).pathname + new URL(input).search;
}

test("complete 3000-file PR fetch succeeds through page 30 and revision recheck", async (t) => {
  const file = { filename: "apps/site/page.md", status: "modified" };
  const page = Array.from({ length: 100 }, () => file);
  const fetch = t.mock.method(globalThis, "fetch", async (input) => {
    const url = prApiUrl(input);
    if (url === "/repos/owner/repo/pulls/12")
      return apiResponse(prMetadata(3000));
    const requestUrl = new URL(input);
    if (
      requestUrl.pathname !== "/repos/owner/repo/pulls/12/files" ||
      requestUrl.searchParams.get("per_page") !== "100"
    )
      throw new Error(`Unexpected PR API request: ${url}`);
    const pageNumber = Number(requestUrl.searchParams.get("page"));
    if (pageNumber > 30) throw new Error("Unexpected request past page 30");
    return apiResponse(page);
  });

  const files = await getPrFiles({
    token: "read-only-token",
    repository: "owner/repo",
    pullNumber: 12,
    expectedBase,
    expectedHead,
  });

  assert.equal(files.length, 3000);
  assert.equal(fetch.mock.callCount(), 32);
});

test("PR file API refuses metadata counts above 3000", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    apiResponse(prMetadata(3001)),
  );
  await assert.rejects(
    getPrFiles({
      token: "read-only-token",
      repository: "owner/repo",
      pullNumber: 12,
      expectedBase,
      expectedHead,
    }),
    /file count exceeds API limit/,
  );
  assert.equal(fetch.mock.callCount(), 1);
});

test("PR file API refuses an incomplete page list", async (t) => {
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = prApiUrl(input);
    if (url === "/repos/owner/repo/pulls/12")
      return apiResponse(prMetadata(101));
    if (url.endsWith("page=1"))
      return apiResponse(
        Array.from({ length: 100 }, () => ({
          filename: "docs/page.md",
          status: "modified",
        })),
      );
    if (url.endsWith("page=2")) return apiResponse([]);
    throw new Error(`Unexpected PR API request: ${url}`);
  });
  await assert.rejects(
    getPrFiles({
      token: "read-only-token",
      repository: "owner/repo",
      pullNumber: 12,
      expectedBase,
      expectedHead,
    }),
    /Incomplete PR file list/,
  );
});

test("PR file API refuses a base or head revision change during pagination", async (t) => {
  let metadataReads = 0;
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = prApiUrl(input);
    if (url === "/repos/owner/repo/pulls/12") {
      metadataReads += 1;
      return apiResponse(
        metadataReads === 1
          ? prMetadata(1)
          : prMetadata(1, { head: { sha: "c".repeat(40) } }),
      );
    }
    if (url.endsWith("page=1"))
      return apiResponse([{ filename: "docs/page.md", status: "modified" }]);
    throw new Error(`Unexpected PR API request: ${url}`);
  });
  await assert.rejects(
    getPrFiles({
      token: "read-only-token",
      repository: "owner/repo",
      pullNumber: 12,
      expectedBase,
      expectedHead,
    }),
    /PR changed while files were fetched/,
  );
});

test("non-PR events always run the full checks", () => {
  for (const eventName of [
    "push",
    "workflow_call",
    "schedule",
    "workflow_dispatch",
    "release",
  ]) {
    assert.equal(
      classifyChanges({ eventName, files: ["README.md"], complete: true })
        .skipExpensive,
      false,
    );
  }
});

const successfulCiJobs = {
  "detect-pr-changes": "success",
  "peekareq-tests": "success",
  "slop-labeler-tests": "success",
  quality: "success",
  unit: "success",
  build: "success",
  integration: "success",
  "docker-build": "success",
  workflows: "success",
  storage: "success",
  "split-images": "success",
  "secret-scan": "success",
  smoke: "success",
};

test("PR result gate permits only deliberate documentation suite skips", () => {
  const jobs = {
    ...successfulCiJobs,
    integration: "skipped",
    storage: "skipped",
    "docker-build": "skipped",
    "split-images": "skipped",
    smoke: "skipped",
  };
  const input = { eventName: "pull_request", skipExpensive: true, jobs };
  assert.equal(assessGate(input), "success");
  for (const job of ["quality", "secret-scan", "detect-pr-changes", "smoke"]) {
    for (const status of ["failure", "cancelled"]) {
      assert.equal(
        assessGate({ ...input, jobs: { ...jobs, [job]: status } }),
        "failure",
        `${job}: ${status} blocks documentation PRs`,
      );
    }
  }
  for (const job of ["quality", "secret-scan"]) {
    assert.equal(
      assessGate({ ...input, jobs: { ...jobs, [job]: "skipped" } }),
      "failure",
    );
  }
  assert.equal(assessGate({ ...input, skipExpensive: false }), "failure");
  assert.equal(
    assessGate({ ...input, jobs: { quality: "success" } }),
    "failure",
  );
});

test("runtime PR result gate requires smoke success and a present result", () => {
  const input = {
    eventName: "pull_request",
    skipExpensive: false,
    jobs: successfulCiJobs,
  };
  assert.equal(assessGate(input), "success");
  for (const job of [
    "smoke",
    "integration",
    "storage",
    "docker-build",
    "split-images",
  ]) {
    for (const status of ["failure", "cancelled", "skipped"]) {
      assert.equal(
        assessGate({ ...input, jobs: { ...successfulCiJobs, [job]: status } }),
        "failure",
        `${job}: ${status} blocks runtime PRs`,
      );
    }
  }
  const withoutSmoke = { ...successfulCiJobs };
  delete withoutSmoke.smoke;
  assert.equal(assessGate({ ...input, jobs: withoutSmoke }), "failure");
});

test("non-PR result gate allows smoke skips but keeps runtime suites required", () => {
  for (const [eventName, skippedSecretResult] of [
    ["push", "failure"],
    ["workflow_dispatch", "failure"],
    ["workflow_call", "failure"],
    ["schedule", "success"],
  ]) {
    const jobs = { ...successfulCiJobs, smoke: "skipped" };
    const input = { eventName, skipExpensive: true, jobs };
    assert.equal(assessGate(input), "success", eventName);
    assert.equal(
      assessGate({ ...input, jobs: { ...jobs, "secret-scan": "skipped" } }),
      skippedSecretResult,
      `${eventName}: scheduled secret-scan exception stays narrow`,
    );
    for (const status of ["failure", "cancelled"]) {
      assert.equal(
        assessGate({ ...input, jobs: { ...jobs, smoke: status } }),
        "failure",
      );
    }
    for (const job of [
      "integration",
      "storage",
      "docker-build",
      "split-images",
    ]) {
      assert.equal(
        assessGate({ ...input, jobs: { ...jobs, [job]: "skipped" } }),
        "failure",
      );
    }
    const withoutSmoke = { ...jobs };
    delete withoutSmoke.smoke;
    assert.equal(assessGate({ ...input, jobs: withoutSmoke }), "failure");
  }
});

test("unknown event context does not authorize a smoke skip", () => {
  for (const eventName of [undefined, "unknown-event"]) {
    assert.equal(
      assessGate({
        eventName,
        skipExpensive: true,
        jobs: { ...successfulCiJobs, smoke: "skipped" },
      }),
      "failure",
    );
  }
});

test("result gate requires successful quality checks on every CI event", () => {
  for (const eventName of [
    "pull_request",
    "push",
    "workflow_dispatch",
    "workflow_call",
    "schedule",
  ]) {
    const jobs = {
      ...successfulCiJobs,
      smoke: eventName === "pull_request" ? "success" : "skipped",
    };
    const input = { eventName, skipExpensive: false, jobs };
    assert.equal(assessGate(input), "success", `${eventName}: all checks pass`);
    const withoutQuality = { ...jobs };
    delete withoutQuality.quality;
    assert.equal(
      assessGate({ ...input, jobs: withoutQuality }),
      "failure",
      `${eventName}: missing quality result blocks the gate`,
    );
    for (const quality of ["failure", "cancelled", "skipped"]) {
      assert.equal(
        assessGate({ ...input, jobs: { ...jobs, quality } }),
        "failure",
        `${eventName}: ${quality} quality checks block the gate`,
      );
    }
  }
});
