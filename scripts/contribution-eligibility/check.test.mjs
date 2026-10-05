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
const link = {
  number: 12,
  repository: { nameWithOwner: "test/repo" },
  state: "OPEN",
  labels: {
    nodes: issue.labels,
    pageInfo: { hasNextPage: false, endCursor: null },
  },
};

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
      if (options.publicationStatus) {
        return Response.json({}, { status: options.publicationStatus });
      }
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
      status = options.listStatus ?? 200;
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
      if (body.query.includes("issue(number:")) {
        return Response.json({
          data: { repository: { issue: { labels: options.labelPage } } },
        });
      }
      const pageIndex = body.variables.after ? Number(body.variables.after) : 0;
      const page = options.linkPages?.[pageIndex] ?? {
        nodes: options.links ?? [
          {
            ...link,
            state: (options.issue ?? issue).state.toUpperCase(),
            labels: {
              nodes: (options.issue ?? issue).labels,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        ],
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
    { links: [null] },
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

test("eligibility lookup and policy errors publish failing checks", async () => {
  for (const options of [
    { permissionStatus: 403 },
    { permissionStatus: 500 },
    { graphqlErrors: true },
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

test("discovery and publication outages preserve prior success until a rerun", async () => {
  for (const failure of ["listStatus", "publicationStatus"]) {
    const options = {};
    const { github, statuses } = fixture(options);
    await reconcile(github, async () => policy);
    assert.equal(statuses.at(-1).state, "success");
    const published = statuses.length;

    options.issue = { ...issue, labels: [] };
    options[failure] = 503;
    await assert.rejects(
      reconcile(github, async () => policy),
      /503/,
    );
    assert.equal(statuses.length, published);
    assert.equal(statuses.at(-1).state, "success");

    delete options[failure];
    await reconcile(github, async () => policy);
    assert.deepEqual(
      statuses.slice(published).map((status) => status.state),
      ["pending", "failure"],
    );
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

test("closing an ineligible PR clears its failure from a shared commit on recheck", async () => {
  const pulls = [pull, { ...pull, number: 2, user: { ...pull.user, id: 456 } }];
  const { github, statuses } = fixture({ pulls, links: [] });
  const vouched = {
    ...policy,
    vouchedContributors: [{ id: 123, login: "trusted", reason: "Trusted." }],
  };
  await reconcile(github, async () => vouched);
  assert.equal(statuses.at(-1).state, "failure");
  assert.match(statuses.at(-1).description, /PR #2/);

  pulls.pop();
  await reconcile(github, async () => vouched);
  assert.equal(statuses.at(-1).sha, sha);
  assert.equal(statuses.at(-1).state, "success");
  assert.match(statuses.at(-1).description, /PR #1/);
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
        pageInfo: { hasNextPage: true, endCursor: "1" },
      },
      {
        nodes: [{ ...link, repository: { nameWithOwner: "TEST/REPO" } }, link],
        pageInfo: { hasNextPage: false, endCursor: "last" },
      },
    ],
  });
  assert.deepEqual(await github.linkedIssues(1), [issue]);
  assert.deepEqual(
    requests.map((request) => request.body.variables.after),
    [null, "1"],
  );
});

test("a thousand closing references use ten batched issue requests", async () => {
  const linkPages = Array.from({ length: 10 }, (_, page) => ({
    nodes: Array.from({ length: 100 }, (_, index) => ({
      ...link,
      number: page * 100 + index + 1,
      labels: {
        ...link.labels,
        nodes: page === 9 && index === 99 ? issue.labels : [],
      },
    })),
    pageInfo: { hasNextPage: page < 9, endCursor: String(page + 1) },
  }));
  const { github, requests, statuses } = fixture({ linkPages });
  await reconcile(github, async () => policy);
  assert.equal(statuses.at(-1).state, "success");
  assert.match(statuses.at(-1).description, /issue #1000/);
  assert.equal(requests.filter(({ path }) => path === "/graphql").length, 10);
  assert.equal(
    requests.some(({ path }) => path.includes("/issues/")),
    false,
  );
});

test("approval labels beyond the first page are included", async () => {
  const { github, requests, statuses } = fixture({
    links: [
      {
        ...link,
        labels: {
          nodes: Array.from({ length: 100 }, (_, index) => ({
            name: `label-${index}`,
          })),
          pageInfo: { hasNextPage: true, endCursor: "labels-next" },
        },
      },
    ],
    labelPage: {
      nodes: issue.labels,
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  });
  await reconcile(github, async () => policy);
  assert.equal(statuses.at(-1).state, "success");
  const labelRequest = requests.find(({ body }) =>
    body?.query?.includes("issue(number:"),
  );
  assert.equal(labelRequest.body.variables.number, 12);
  assert.equal(labelRequest.body.variables.after, "labels-next");
});

test("missing or invalid label pages fail the affected eligibility check", async () => {
  for (const cursor of [null, "labels-next"]) {
    const { github, statuses } = fixture({
      links: [
        {
          ...link,
          labels: {
            nodes: [],
            pageInfo: { hasNextPage: true, endCursor: cursor },
          },
        },
      ],
    });
    await assert.rejects(
      reconcile(github, async () => policy),
      AggregateError,
    );
    assert.equal(statuses.at(-1).state, "failure");
  }
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
  await assert.rejects(github.linkedIssues(1), /pagination cursor/);
  assert.throws(
    () =>
      new GitHub({ GITHUB_REPOSITORY: "../invalid", GH_TOKEN: "synthetic" }),
  );
  assert.throws(() => new GitHub({ GITHUB_REPOSITORY: "test/repo" }));
});
