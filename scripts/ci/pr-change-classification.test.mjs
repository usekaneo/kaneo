import test from "node:test";
import assert from "node:assert/strict";
import { classifyChanges, assessGate } from "./pr-change-classification.mjs";

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

test("result gate accepts only successful jobs and deliberate expensive skips", () => {
  const ciJobs = {
    "detect-pr-changes": "success",
    "peekareq-tests": "success",
    "slop-labeler-tests": "success",
    lint: "success",
    i18n: "success",
    openapi: "success",
    typecheck: "success",
    unit: "success",
    build: "success",
    integration: "skipped",
    "docker-build": "skipped",
    workflows: "success",
    storage: "skipped",
    "split-images": "skipped",
    "secret-scan": "success",
  };
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "pull_request",
      skipExpensive: true,
      jobs: ciJobs,
    }),
    "success",
  );
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "pull_request",
      skipExpensive: true,
      jobs: { ...ciJobs, "secret-scan": "skipped" },
    }),
    "failure",
  );
  for (const state of ["failure", "cancelled", "skipped"]) {
    assert.equal(
      assessGate({
        workflow: "ci",
        eventName: "pull_request",
        skipExpensive: true,
        jobs: { ...ciJobs, lint: state },
      }),
      "failure",
    );
    assert.equal(
      assessGate({
        workflow: "ci",
        eventName: "pull_request",
        skipExpensive: false,
        jobs: { ...ciJobs, integration: state },
      }),
      "failure",
    );
  }
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "push",
      skipExpensive: false,
      jobs: ciJobs,
    }),
    "failure",
  );
  const scheduled = {
    ...ciJobs,
    integration: "success",
    storage: "success",
    "docker-build": "success",
    "split-images": "success",
    "secret-scan": "skipped",
  };
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "schedule",
      skipExpensive: false,
      jobs: scheduled,
    }),
    "success",
  );
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "schedule",
      skipExpensive: false,
      jobs: { ...scheduled, integration: "skipped" },
    }),
    "failure",
  );
  assert.equal(
    assessGate({
      workflow: "ci",
      eventName: "pull_request",
      skipExpensive: true,
      jobs: { lint: "success" },
    }),
    "failure",
  );
  assert.equal(
    assessGate({
      workflow: "browser",
      eventName: "pull_request",
      skipExpensive: true,
      jobs: { "detect-pr-changes": "success", smoke: "skipped" },
    }),
    "success",
  );
});
