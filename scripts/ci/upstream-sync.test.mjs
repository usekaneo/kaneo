import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../../.github/workflows/upstream-kaneo.yml", import.meta.url),
    "utf8",
  ),
);
const step = workflow.jobs.sync.steps[0];

function fixture({
  ahead = 1,
  existing = [],
  raced = [],
  createError,
  compareError,
} = {}) {
  const calls = [];
  const messages = [];
  let listed = 0;
  const record = (method, args) =>
    calls.push({ method, args: structuredClone(args) });
  const github = {
    rest: {
      repos: {
        compareCommitsWithBasehead: async (args) => {
          record("compare", args);
          if (compareError) throw compareError;
          return { data: { ahead_by: ahead } };
        },
      },
      pulls: {
        list: async (args) => {
          record("list", args);
          return { data: listed++ ? raced : existing };
        },
        create: async (args) => {
          record("create", args);
          if (createError) throw createError;
          return {
            data: {
              html_url: "https://github.com/PlaybookMediaLLC/kaneo/pull/100",
            },
          };
        },
      },
    },
  };
  const run = () =>
    vm.runInNewContext(
      `(async () => {\n${step.with.script}\n})()`,
      {
        github,
        context: { repo: { owner: "PlaybookMediaLLC", repo: "kaneo" } },
        core: { info: (message) => messages.push(message) },
      },
      { timeout: 1000 },
    );
  return { run, calls, messages };
}

test("nightly sync is scoped, pinned, serialized and cannot push or execute upstream code", () => {
  assert.equal(workflow.on.schedule[0].cron, "17 7 * * *");
  assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
  assert.deepEqual(workflow.permissions, {});
  assert.deepEqual(workflow.jobs.sync.permissions, {
    contents: "read",
    "pull-requests": "write",
  });
  assert.equal(
    workflow.jobs.sync.if,
    // eslint-disable-next-line no-template-curly-in-string -- GitHub evaluates this literal expression.
    "${{ github.repository == 'PlaybookMediaLLC/kaneo' }}",
  );
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.equal(workflow.jobs.sync.steps.length, 1);
  assert.match(step.uses, /^actions\/github-script@[a-f0-9]{40}$/);
  assert.equal(workflow.jobs.sync["timeout-minutes"], 5);
});

test("an already integrated upstream branch creates no PR", async () => {
  const f = fixture({ ahead: 0 });
  await f.run();
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ["compare"],
  );
  assert.match(f.messages[0], /nothing to sync/);
});

test("new commits create a review PR directly from upstream main into develop", async () => {
  const f = fixture({ ahead: 2 });
  await f.run();
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ["compare", "list", "create"],
  );
  assert.equal(f.calls[0].args.basehead, "develop...usekaneo:main");
  const created = f.calls[2].args;
  assert.equal(created.owner, "PlaybookMediaLLC");
  assert.equal(created.repo, "kaneo");
  assert.equal(created.head, "usekaneo:main");
  assert.equal(created.base, "develop");
  assert.equal(created.maintainer_can_modify, false);
  assert.match(created.body, /public-branding checks/);
});

test("an existing upstream PR is reused without duplicate writes", async () => {
  const f = fixture({
    existing: [
      { html_url: "https://github.com/PlaybookMediaLLC/kaneo/pull/101" },
    ],
  });
  await f.run();
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ["compare", "list"],
  );
  assert.equal(f.calls[1].args.head, "usekaneo:main");
  assert.equal(f.calls[1].args.base, "develop");
});

test("a concurrent PR creation is accepted only when the same PR exists", async () => {
  const error = Object.assign(new Error("Validation failed"), { status: 422 });
  const f = fixture({
    createError: error,
    raced: [{ html_url: "https://github.com/PlaybookMediaLLC/kaneo/pull/102" }],
  });
  await f.run();
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ["compare", "list", "create", "list"],
  );
  const invalid = fixture({ createError: error });
  await assert.rejects(invalid.run(), (failure) => failure === error);
});

test("API failures and invalid comparison results fail closed", async () => {
  const error = Object.assign(new Error("No common ancestor"), { status: 409 });
  const f = fixture({ compareError: error });
  await assert.rejects(f.run(), (failure) => failure === error);
  assert.deepEqual(
    f.calls.map((call) => call.method),
    ["compare"],
  );
  for (const ahead of [-1, "1", null]) {
    const invalid = fixture({ ahead });
    await assert.rejects(invalid.run(), /Unexpected upstream comparison/);
    assert.deepEqual(
      invalid.calls.map((call) => call.method),
      ["compare"],
    );
  }
});
