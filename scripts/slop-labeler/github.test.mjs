import assert from "node:assert/strict";
import { test } from "node:test";
import { GitHub } from "./github.mjs";
import { env } from "./test-fixtures.mjs";

test("rejects unsafe repository/API configuration before making requests", () => {
  for (const repository of [
    "../secret",
    "repo/../../secret",
    "owner/repo?token=bad",
    "https://example.com/repo",
  ]) {
    assert.throws(
      () => new GitHub({ ...env, GITHUB_REPOSITORY: repository }),
      /repository/,
    );
  }
  for (const url of [
    "http://api.github.com",
    "https://user:password@api.github.com",
    "https://api.github.com?query=value",
    "https://api.github.com/#fragment",
  ]) {
    assert.throws(() => new GitHub({ ...env, GITHUB_API_URL: url }), /URL/);
  }
  assert.throws(() => new GitHub({ ...env, GH_TOKEN: "" }), /token/);
});

test("rejects oversized responses and malformed blobs", async () => {
  const oversized = new GitHub(
    env,
    async () => new Response('"' + "a".repeat(8_000_001) + '"'),
  );
  await assert.rejects(
    oversized.request("/repos/usekaneo/kaneo/pulls/42"),
    /limit/,
  );
  const sha = "a".repeat(40);
  for (const blob of [
    { sha, encoding: "utf8", content: "source", size: 6 },
    { sha, encoding: "base64", content: "YQ==", size: 2 },
    { sha: "b".repeat(40), encoding: "base64", content: "YQ==", size: 1 },
    { sha, encoding: "base64", content: "/w==", size: 1 },
  ]) {
    const github = new GitHub(
      env,
      async () => new Response(JSON.stringify(blob)),
    );
    await assert.rejects(github.source({ sha }, "contributor/fork"));
  }
});

test("HTTP failures do not include source response contents or tokens", async () => {
  const github = new GitHub(
    env,
    async () => new Response("sensitive untrusted content", { status: 403 }),
  );
  await assert.rejects(
    github.request("/repos/usekaneo/kaneo/pulls/42"),
    (error) => {
      assert.equal(error.status, 403);
      assert.doesNotMatch(error.message, /sensitive|token/);
      return true;
    },
  );
});
