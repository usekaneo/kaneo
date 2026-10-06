import assert from "node:assert/strict";
import test from "node:test";
import { GitHub } from "./github.mjs";

const token = "synthetic-token";

function githubResponse(response) {
  return new GitHub(
    { GITHUB_REPOSITORY: "test/repo", GH_TOKEN: token },
    async () => Response.json(response),
  );
}

test("draft conversion reports the GraphQL permission rejection", async () => {
  const github = githubResponse({
    data: { convertPullRequestToDraft: null },
    errors: [
      {
        type: "FORBIDDEN",
        message: "Resource not accessible by integration",
        path: ["convertPullRequestToDraft"],
      },
    ],
  });
  await assert.rejects(github.convertToDraft("PR_test_1"), (error) => {
    assert.match(error.message, /FORBIDDEN/);
    assert.match(error.message, /Resource not accessible by integration/);
    return true;
  });
});

test("GraphQL diagnostics redact tokens and omit response data", async () => {
  const github = githubResponse({
    data: { privateData: "not-for-logs" },
    errors: [
      {
        type: "FORBIDDEN",
        message: `Rejected ${token}\n::error::injected`,
        extensions: { privateData: "not-for-logs" },
      },
    ],
  });
  await assert.rejects(github.convertToDraft("PR_test_1"), (error) => {
    assert.match(error.message, /Rejected \[redacted\]/);
    assert.equal(error.message.includes(token), false);
    assert.equal(error.message.includes("not-for-logs"), false);
    assert.equal(/\p{Cc}/u.test(error.message), false);
    return true;
  });
});

test("GraphQL diagnostics remain bounded for oversized errors", async () => {
  const github = githubResponse({
    errors: [{ type: "FORBIDDEN", message: "x".repeat(10_000) }],
  });
  await assert.rejects(github.convertToDraft("PR_test_1"), (error) => {
    assert.ok(error.message.length < 1_100);
    assert.match(error.message, /FORBIDDEN/);
    return true;
  });
});
