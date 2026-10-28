import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPullRequest } from "./check.mjs";
import { scanComment, ownsLabel, marker } from "./comment.mjs";
import {
  fixture,
  sourceFile,
  flagged,
  clear,
  writes,
  env,
  event,
} from "./test-fixtures.mjs";

test("manual runs validate the PR number and use the same author exclusion", async () => {
  const dispatch = { inputs: { pull_request_number: "42" } };
  const contributor = fixture();
  assert.equal(
    await checkPullRequest(dispatch, env, contributor.fetcher, flagged),
    "flagged",
  );
  const maintainer = fixture({ authorAccess: { permission: "write" } });
  assert.equal(
    await checkPullRequest(dispatch, env, maintainer.fetcher, flagged),
    "maintainer",
  );
  assert.equal(writes(maintainer.state).length, 0);
  for (const number of [
    undefined,
    "",
    "0",
    "-1",
    "42.5",
    "invalid",
    "9007199254740992",
  ]) {
    const { state, fetcher } = fixture();
    await assert.rejects(
      checkPullRequest(
        { inputs: { pull_request_number: number } },
        env,
        fetcher,
        flagged,
      ),
      /Invalid pull request number/,
    );
    assert.equal(state.calls.length, 0);
  }
});

test("adds the label and one advisory comment; reruns neither duplicate nor rewrite it", async () => {
  const { state, fetcher } = fixture({ labelExists: false });
  assert.equal(await checkPullRequest(event, env, fetcher, flagged), "flagged");
  assert.equal(state.comments.length, 1);
  assert.equal(ownsLabel(state.comments[0]), true);
  assert.match(state.comments[0].body, /detector can be wrong/);
  assert.match(state.comments[0].body, /ignore this message and the label/);
  assert.match(
    state.comments[0].body,
    /do not need to explain or change anything/,
  );
  assert.deepEqual(state.pull.labels, [{ name: "slop" }]);
  const count = writes(state).length;
  await checkPullRequest(event, env, fetcher, flagged);
  assert.equal(writes(state).length, count);
  assert.equal(state.comments.length, 1);
});

test("edits retract the workflow label and update its existing message", async () => {
  const { state, fetcher } = fixture();
  await checkPullRequest(event, env, fetcher, flagged);
  await checkPullRequest(event, env, fetcher, clear);
  assert.deepEqual(state.pull.labels, []);
  assert.equal(state.comments.length, 1);
  assert.match(state.comments[0].body, /no longer triggers/);
  assert.equal(ownsLabel(state.comments[0]), false);
  const count = writes(state).length;
  await checkPullRequest(event, env, fetcher, clear);
  assert.equal(writes(state).length, count);
});

test("manual labels survive clearing, including labels added after an earlier scan cleared", async () => {
  const { state, fetcher } = fixture({
    pull: { labels: [{ name: "slop" }, { name: "bug" }] },
  });
  await checkPullRequest(event, env, fetcher, flagged);
  assert.equal(ownsLabel(state.comments[0]), false);
  await checkPullRequest(event, env, fetcher, clear);
  assert.deepEqual(state.pull.labels, [{ name: "slop" }, { name: "bug" }]);

  const other = fixture();
  await checkPullRequest(event, env, other.fetcher, flagged);
  await checkPullRequest(event, env, other.fetcher, clear);
  other.state.pull.labels.push({ name: "slop" });
  await checkPullRequest(event, env, other.fetcher, clear);
  assert.deepEqual(other.state.pull.labels, [{ name: "slop" }]);
});

test("a marker in a contributor comment is never treated as a bot-owned comment", async () => {
  const forged = {
    id: 99,
    user: { login: "contributor", type: "User" },
    body: scanComment(true, true),
  };
  const { state, fetcher } = fixture({ comments: [forged] });
  await checkPullRequest(event, env, fetcher, flagged);
  assert.equal(state.comments.length, 2);
  assert.deepEqual(state.comments[0], forged);
  assert.equal(state.comments[1].body.startsWith(marker), true);
});

test("paginates both files and comments before publishing", async () => {
  const files = Array.from({ length: 101 }, (_, index) => ({
    filename: `${index}.md`,
    status: "modified",
    additions: 1,
  }));
  const comments = Array.from({ length: 100 }, (_, index) => ({
    id: index,
    user: { login: "author", type: "User" },
    body: "Discussion.",
  }));
  comments.push({
    id: 123,
    user: { login: "github-actions[bot]", type: "Bot" },
    body: scanComment(true, true),
  });
  const { state, fetcher } = fixture({
    files,
    comments,
    pull: { labels: [{ name: "slop" }] },
  });
  assert.equal(await checkPullRequest(event, env, fetcher), "clear");
  assert.equal(state.comments.length, 101);
  assert.match(state.comments[100].body, /no longer triggers/);
  assert.equal(
    state.calls.filter((call) => call.pathname.endsWith("/files")).length,
    2,
  );
  assert.equal(
    state.calls.filter(
      (call) => call.pathname.endsWith("/comments") && call.method === "GET",
    ).length,
    2,
  );
});

test("changed heads, changed bases and closed PRs are not mutated", async () => {
  for (const options of [
    { stale: true },
    { staleBase: true },
    { pull: { state: "closed" } },
  ]) {
    const { state, fetcher } = fixture(options);
    const status = await checkPullRequest(event, env, fetcher, flagged);
    assert.ok(["stale", "closed"].includes(status));
    assert.equal(writes(state).length, 0);
  }
});

test("incomplete file lists and source patches never retract an existing label", async () => {
  for (const options of [
    { pull: { changed_files: 3001 } },
    { pull: { changed_files: 1 } },
    { files: [{ ...sourceFile("// Explanation."), patch: undefined }] },
  ]) {
    const { state, fetcher } = fixture({
      ...options,
      pull: { labels: [{ name: "slop" }], ...options.pull },
      comments: [
        {
          id: 123,
          user: { login: "github-actions[bot]", type: "Bot" },
          body: scanComment(true, true),
        },
      ],
    });
    await assert.rejects(checkPullRequest(event, env, fetcher));
    assert.equal(writes(state).length, 0);
    assert.equal(state.pull.labels[0].name, "slop");
  }
});

test("reads immutable source blobs, falls back to a fork, and never runs PR code", async () => {
  const source =
    "// A short explanation.\nglobalThis.__slopGitHubExecuted = true;";
  const file = sourceFile(source, "nested/source.ts");
  const { state, fetcher } = fixture({
    files: [file],
    intercept: ({ pathname, response }) =>
      pathname.startsWith("/repos/usekaneo/kaneo/git/blobs/")
        ? response({}, 404)
        : null,
  });
  const maliciousEvent = {
    pull_request: {
      number: 42,
      head: { repo: { full_name: "evil/../../secret" } },
    },
  };
  assert.equal(await checkPullRequest(maliciousEvent, env, fetcher), "clear");
  assert.equal(globalThis.__slopGitHubExecuted, undefined);
  assert.ok(
    state.calls.some(
      (call) =>
        call.pathname === `/repos/contributor/fork/git/blobs/${file.sha}`,
    ),
  );
  assert.equal(writes(state).length, 0);
});

test("label-creation races are repaired when another PR created the label", async () => {
  const { state, fetcher } = fixture({
    labelExists: false,
    intercept: ({ pathname, method, state: current, response }) => {
      if (pathname === "/repos/usekaneo/kaneo/labels" && method === "POST") {
        current.labelExists = true;
        return response({}, 422);
      }
      return null;
    },
  });
  assert.equal(await checkPullRequest(event, env, fetcher, flagged), "flagged");
  assert.deepEqual(state.pull.labels, [{ name: "slop" }]);
});

test("a failed label write is repaired on retry without a duplicate message", async () => {
  let fail = true;
  const { state, fetcher } = fixture({
    intercept: ({ pathname, method, response }) => {
      if (fail && pathname.endsWith("/issues/42/labels") && method === "POST") {
        fail = false;
        return response({}, 503);
      }
      return null;
    },
  });
  await assert.rejects(checkPullRequest(event, env, fetcher, flagged), /503/);
  assert.equal(state.comments.length, 1);
  assert.equal(ownsLabel(state.comments[0]), true);
  await checkPullRequest(event, env, fetcher, flagged);
  assert.equal(state.comments.length, 1);
  assert.deepEqual(state.pull.labels, [{ name: "slop" }]);
});

test("a failed retraction keeps ownership for a retry", async () => {
  let fail = true;
  const { state, fetcher } = fixture({
    pull: { labels: [{ name: "slop" }] },
    comments: [
      {
        id: 123,
        body: scanComment(true, true),
        user: { login: "github-actions[bot]", type: "Bot" },
      },
    ],
    intercept: ({ method, response }) => {
      if (fail && method === "DELETE") {
        fail = false;
        return response({}, 503);
      }
      return null;
    },
  });
  await assert.rejects(checkPullRequest(event, env, fetcher, clear), /503/);
  assert.equal(ownsLabel(state.comments[0]), true);
  await checkPullRequest(event, env, fetcher, clear);
  assert.equal(ownsLabel(state.comments[0]), false);
  assert.deepEqual(state.pull.labels, []);
});

test("real classification and API reconciliation flag two fixtures and clear on edits", async () => {
  const first = `// Only \`owner\` stays static so its permissions can never be edited away
// from the workspace creator. \`viewer\`, \`member\`, and \`admin\` are
// seeded into \`workspace_role\` per workspace and resolved via
// dynamic access control, so admins can fully override (replace) their
// permissions per workspace. See \`seedDefaultWorkspaceRoles\` + the
// afterCreateOrganization hook.`;
  const second = `// \`ac\` is created with a narrow \`statement\` shape (project/task/label/
// workspace + the default org statements), which makes its inferred
// \`newRole\` generic incompatible with better-auth's looser
// \`AccessControl\` type. Widen via an explicit cast so the plugin
// accepts our custom statement.`;
  const files = [sourceFile(`${first}\nconst x = 1;\n${second}\nconst y = 2;`)];
  const { state, fetcher } = fixture({ files });
  assert.equal(await checkPullRequest(event, env, fetcher), "flagged");
  assert.equal(state.comments.length, 1);
  assert.deepEqual(state.pull.labels, [{ name: "slop" }]);
  files.splice(
    0,
    1,
    sourceFile("// One brief human-readable explanation.\nconst value = 1;"),
  );
  assert.equal(await checkPullRequest(event, env, fetcher), "clear");
  assert.equal(state.comments.length, 1);
  assert.deepEqual(state.pull.labels, []);
});
