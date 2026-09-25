import assert from "node:assert/strict";
import test from "node:test";
import { authorizeRequest } from "../request.mjs";

const event = {
  repository: { full_name: "usekaneo/kaneo" },
  action: "created",
  issue: { number: 1719, pull_request: {} },
  comment: {
    id: 123,
    body: "/peekareq",
    user: { login: "maintainer", type: "User" },
  },
};
function mock({
  permission = "write",
  body = "/peekareq",
  state = "open",
  repo = "usekaneo/kaneo",
} = {}) {
  const calls = [];
  const api = async (endpoint) => {
    calls.push(endpoint);
    if (endpoint.endsWith("/comments/123"))
      return {
        body,
        user: event.comment.user,
        issue_url: "https://api.github.com/repos/usekaneo/kaneo/issues/1719",
      };
    if (endpoint.endsWith("/maintainer/permission")) return { permission };
    if (endpoint.endsWith("/pulls/1719"))
      return { state, base: { repo: { full_name: repo } } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };
  return { api, calls };
}

test("new exact command authorizes write, maintain, and admin users using live permissions", async () => {
  for (const permission of ["write", "maintain", "admin"]) {
    const { api, calls } = mock({ permission });
    const result = await authorizeRequest("issue_comment", event, api);
    assert.equal(result.allowed, true);
    assert.equal(result.pr, 1719);
    assert.equal(result.model, "qwen/qwen3.8-flash");
    assert.equal(
      calls[1],
      "repos/usekaneo/kaneo/collaborators/maintainer/permission",
    );
  }
});

test("code review dispatch cannot be confused with a screenshot command", async () => {
  const payload = {
    action: "peekareview",
    repository: event.repository,
    sender: { login: "peekareq[bot]", type: "Bot" },
    client_payload: { pr: 1719, comment_id: 123 },
  };
  const result = await authorizeRequest(
    "repository_dispatch",
    payload,
    mock({ body: "/peekareview" }).api,
    "peekareview",
  );
  assert.equal(result.allowed, true);
  assert.equal(result.command, "peekareview");
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        payload,
        mock({ body: "/peekareview" }).api,
      )
    ).allowed,
    false,
  );
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        payload,
        mock().api,
        "peekareview",
      )
    ).allowed,
    false,
  );
  assert.equal(
    (
      await authorizeRequest(
        "repository_dispatch",
        payload,
        mock({ body: "/peekareview", permission: "triage" }).api,
        "peekareview",
      )
    ).allowed,
    false,
  );
});

test("membership and contributor association never substitute for write permission", async () => {
  for (const permission of ["read", "triage", "none", undefined]) {
    const { api, calls } = mock({ permission: permission ?? "" });
    const payload = structuredClone(event);
    payload.comment.author_association = "MEMBER";
    assert.equal(
      (await authorizeRequest("issue_comment", payload, api)).allowed,
      false,
    );
    assert.equal(
      calls.some((x) => x.includes("/pulls/")),
      false,
    );
  }
});

test("quoted commands, prefixes, extra arguments, and shell syntax do not start a run", async () => {
  for (const body of [
    "Please /peekareq",
    "> /peekareq",
    "```\n/peekareq\n```",
    "/peekareq test",
    "/peekareq\n$(echo nope)",
    "/peekareq-extra",
    "/Peekareq",
  ]) {
    const payload = structuredClone(event);
    payload.comment.body = body;
    const { api, calls } = mock();
    assert.equal(
      (await authorizeRequest("issue_comment", payload, api)).allowed,
      false,
    );
    assert.equal(calls.length, 0);
  }
});

test("surrounding whitespace is allowed", async () => {
  const payload = structuredClone(event);
  payload.comment.body = " \n/peekareq\n ";
  const { api } = mock({ body: payload.comment.body });
  assert.equal(
    (await authorizeRequest("issue_comment", payload, api)).allowed,
    true,
  );
});

test("bot comments, comment edits, ordinary issues, and other repositories are ignored", async () => {
  const variants = [
    { ...event, action: "edited" },
    { ...event, issue: { number: 1719 } },
    { ...event, repository: { full_name: "other/repo" } },
    {
      ...event,
      comment: {
        ...event.comment,
        user: { login: "peekareq[bot]", type: "Bot" },
      },
    },
  ];
  for (const payload of variants) {
    const { api, calls } = mock();
    assert.equal(
      (await authorizeRequest("issue_comment", payload, api)).allowed,
      false,
    );
    assert.equal(calls.length, 0);
  }
});

test("changed comments and closed or mismatched PRs fail closed", async () => {
  for (const options of [
    { body: "cancelled" },
    { state: "closed" },
    { repo: "other/repo" },
  ]) {
    const { api } = mock(options);
    assert.equal(
      (await authorizeRequest("issue_comment", event, api)).allowed,
      false,
    );
  }
});

test("permission API errors cannot authorize a run", async () => {
  const { api } = mock();
  await assert.rejects(
    authorizeRequest("issue_comment", event, async (endpoint) => {
      if (endpoint.endsWith("/permission")) throw new Error("HTTP 403");
      return api(endpoint);
    }),
    /HTTP 403/,
  );
});

test("manual dispatch uses the same permission gate and rejects output injection", async () => {
  const payload = {
    repository: event.repository,
    sender: event.comment.user,
    inputs: { pr: "1719", model: "qwen/qwen3.8-flash" },
  };
  assert.equal(
    (await authorizeRequest("workflow_dispatch", payload, mock().api)).allowed,
    true,
  );
  assert.equal(
    (
      await authorizeRequest(
        "workflow_dispatch",
        payload,
        mock({ permission: "read" }).api,
      )
    ).allowed,
    false,
  );
  const { api, calls } = mock();
  payload.inputs.model = "qwen/model\nallowed=true";
  assert.equal(
    (await authorizeRequest("workflow_dispatch", payload, api)).allowed,
    false,
  );
  assert.equal(calls.length, 0);
});
