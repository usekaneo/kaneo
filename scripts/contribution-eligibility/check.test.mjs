import assert from "node:assert/strict";
import test from "node:test";
import { reconcile } from "./check.mjs";
import { GitHub } from "./github.mjs";
import { statusContext } from "./policy.mjs";

const sha = "a".repeat(40);
const policy = { vouchedContributors: [], exemptBots: [] };
const pull = {
  number: 1,
  state: "open",
  user: { id: 123, login: "newcomer", type: "User" },
  head: { sha },
  base: { ref: "main" },
  body: "Fixes #12",
};
const issue = {
  number: 12,
  state: "open",
  labels: [{ name: "ready-for-contribution" }],
};
const link = { number: 12, repository: { nameWithOwner: "test/repo" } };

function fixture(options = {}) {
  const requests = [];
  const statuses = [];
  const checks = new Map();
  const pulls = options.pulls ?? [pull];
  const fetcher = async (url, init) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ path, body });
    let data;
    let status = 200;
    if (path.includes("/check-runs")) {
      const id =
        init.method === "POST"
          ? checks.size + 1
          : Number(path.split("/").at(-1));
      const head = body.head_sha ?? checks.get(id).sha;
      const state = body.status === "in_progress" ? "pending" : body.conclusion;
      const entry = {
        id,
        sha: head,
        context: body.name,
        state,
        description: body.output.title,
        target_url: body.details_url,
      };
      statuses.push(entry);
      checks.set(id, entry);
      data = { id };
    } else if (path === "/repos/test/repo/pulls") {
      data = options.pullPages
        ? options.pullPages[Number(parsed.searchParams.get("page")) - 1]
        : pulls;
    } else if (path.startsWith("/repos/test/repo/pulls/")) {
      const current = pulls.find(
        (item) => item.number === Number(path.split("/").at(-1)),
      );
      data = { ...current, ...options.current };
    } else if (path.includes("/collaborators/")) {
      status = options.permissionStatus ?? (options.permission ? 200 : 404);
      data = options.permission ?? {};
    } else if (path === "/graphql") {
      const page = options.linkPages?.[body.variables.after ? 1 : 0] ?? {
        nodes: options.links ?? [link],
        pageInfo: { hasNextPage: false, endCursor: null },
      };
      data = options.graphqlErrors
        ? {
            errors: [{ message: "synthetic failure" }],
            data: { repository: null },
          }
        : {
            data: {
              repository: { pullRequest: { closingIssuesReferences: page } },
            },
          };
    } else if (path.startsWith("/repos/test/repo/issues/")) {
      data = options.issue ?? issue;
      status = options.issueStatus ?? 200;
    } else {
      throw new Error(`Unexpected test request: ${path}`);
    }
    return Response.json(data, { status });
  };
  const github = new GitHub(
    {
      GITHUB_REPOSITORY: "test/repo",
      GH_TOKEN: "synthetic-token",
      GITHUB_API_URL: "https://api.github.test",
      GITHUB_GRAPHQL_URL: "https://api.github.test/graphql",
    },
    fetcher,
  );
  return { github, requests, statuses };
}

test("approved issue publishes pending then success on the fork's exact head", async () => {
  const { github, statuses } = fixture();
  const results = await reconcile(github, async () => policy);
  assert.equal(results[0].state, "success");
  assert.deepEqual(
    statuses.map((status) => [status.sha, status.context, status.state]),
    [
      [sha, statusContext, "pending"],
      [sha, statusContext, "success"],
    ],
  );
  assert.match(
    statuses.at(-1).target_url,
    /CONTRIBUTING\.md#contribution-eligibility$/,
  );
});

test("mere mentions, foreign issues, deleted issues and revoked approval fail", async () => {
  for (const options of [
    { links: [] },
    { links: [{ ...link, repository: { nameWithOwner: "other/repo" } }] },
    { issueStatus: 404 },
    { issue: { ...issue, labels: [] } },
    { issue: { ...issue, state: "closed" } },
  ]) {
    const { github, statuses } = fixture(options);
    await reconcile(github, async () => policy);
    assert.equal(statuses.at(-1).state, "failure");
    assert.match(statuses.at(-1).description, /ready-for-contribution/);
  }
});

test("granting and revoking a voucher changes the result without a new commit", async () => {
  const { github, statuses, requests } = fixture({ links: [] });
  const vouched = {
    ...policy,
    vouchedContributors: [{ id: 123, login: "old-name", reason: "Trusted." }],
  };
  await reconcile(github, async () => vouched);
  assert.equal(statuses.at(-1).state, "success");
  assert.equal(
    requests.some((request) => request.path.includes("/collaborators/")),
    false,
  );
  await reconcile(github, async () => policy);
  assert.equal(statuses.at(-1).state, "failure");
});

test("repository maintainers and explicit automation can omit issues", async () => {
  const maintainer = fixture({
    permission: { permission: "write", role_name: "maintain" },
    links: [],
  });
  await reconcile(maintainer.github, async () => policy);
  assert.equal(maintainer.statuses.at(-1).state, "success");
  assert.equal(
    maintainer.requests.some((request) => request.path === "/graphql"),
    false,
  );
  const bot = fixture({
    pulls: [{ ...pull, user: { ...pull.user, type: "Bot" } }],
    links: [],
  });
  await reconcile(bot.github, async () => ({
    ...policy,
    exemptBots: [{ id: 123, login: "automation[bot]", reason: "Approved." }],
  }));
  assert.equal(bot.statuses.at(-1).state, "success");
  assert.equal(
    bot.requests.some((request) => request.path.includes("/collaborators/")),
    false,
  );
  await reconcile(bot.github, async () => policy);
  assert.equal(bot.statuses.at(-1).state, "failure");
});

test("API and policy errors replace an earlier successful status with error", async () => {
  for (const options of [
    { permissionStatus: 403 },
    { permissionStatus: 500 },
    { graphqlErrors: true },
    { issueStatus: 500 },
  ]) {
    const { github, statuses } = fixture(options);
    await assert.rejects(
      reconcile(github, async () => policy),
      AggregateError,
    );
    assert.deepEqual(
      statuses.map((status) => status.state),
      ["pending", "failure"],
    );
  }
  for (const loader of [
    async () => ({}),
    async () => {
      throw new SyntaxError("Invalid JSON");
    },
  ]) {
    const { github, statuses } = fixture();
    await assert.rejects(reconcile(github, loader), AggregateError);
    assert.equal(statuses.at(-1).state, "failure");
  }
});

test("a changed head, body or target cannot receive a stale success", async () => {
  for (const current of [
    { head: { sha: "b".repeat(40) } },
    { body: "Removed the issue link." },
    { base: { ref: "other" } },
  ]) {
    const { github, statuses } = fixture({ current });
    await reconcile(github, async () => policy);
    assert.equal(statuses.at(-1).state, "pending");
    assert.equal(
      statuses.some((status) => status.state === "success"),
      false,
    );
    assert.equal(
      statuses.every((status) => status.sha === sha),
      true,
    );
  }
  const closed = fixture({ current: { state: "closed" } });
  assert.deepEqual(await reconcile(closed.github, async () => policy), []);
  assert.equal(
    closed.statuses.some((status) => status.state === "success"),
    false,
  );
});

test("a vouched PR never overrides an ineligible PR on the same commit", async () => {
  for (const reverse of [false, true]) {
    const newcomer = { ...pull, number: 2, user: { ...pull.user, id: 456 } };
    const { github, statuses } = fixture({
      pulls: reverse ? [newcomer, pull] : [pull, newcomer],
      links: [],
    });
    await reconcile(github, async () => ({
      ...policy,
      vouchedContributors: [{ id: 123, login: "trusted", reason: "Trusted." }],
    }));
    assert.equal(statuses.at(-1).state, "failure");
    assert.equal(
      statuses.some((status) => status.state === "success"),
      false,
    );
    assert.match(statuses.at(-1).description, /PR #2/);
  }
});

test("a failure on one PR still updates other PRs before failing the workflow", async () => {
  const { github, statuses } = fixture({
    pulls: [pull, { ...pull, number: 2, head: { sha: "b".repeat(40) } }],
    permissionStatus: 500,
  });
  await assert.rejects(
    reconcile(github, async () => policy),
    AggregateError,
  );
  assert.equal(
    statuses.filter((status) => status.state === "failure").length,
    2,
  );
});

test("linked issues paginate and accept case-insensitive repository names", async () => {
  const { github, requests } = fixture({
    linkPages: [
      {
        nodes: [{ ...link, repository: { nameWithOwner: "foreign/repo" } }],
        pageInfo: { hasNextPage: true, endCursor: "next" },
      },
      {
        nodes: [{ ...link, repository: { nameWithOwner: "TEST/REPO" } }, link],
        pageInfo: { hasNextPage: false, endCursor: "last" },
      },
    ],
  });
  assert.deepEqual(await github.linkedIssueNumbers(1), [12]);
  assert.deepEqual(
    requests.map((request) => request.body.variables.after),
    [null, "next"],
  );
});

test("open PRs paginate beyond the first hundred", async () => {
  const first = Array.from({ length: 100 }, (_, index) => ({
    number: index + 1,
  }));
  const { github } = fixture({ pullPages: [first, [{ number: 101 }]] });
  assert.equal((await github.openPullRequests()).length, 101);
});

test("invalid pagination and missing configuration reject", async () => {
  const { github } = fixture({
    linkPages: [
      { nodes: [], pageInfo: { hasNextPage: true, endCursor: null } },
    ],
  });
  await assert.rejects(github.linkedIssueNumbers(1), /pagination cursor/);
  assert.throws(
    () =>
      new GitHub({ GITHUB_REPOSITORY: "../invalid", GH_TOKEN: "synthetic" }),
  );
  assert.throws(() => new GitHub({ GITHUB_REPOSITORY: "test/repo" }));
});
