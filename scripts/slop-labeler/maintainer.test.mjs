import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPullRequest } from "./check.mjs";
import { fixture, flagged, writes, env, event } from "./test-fixtures.mjs";

test("maintainer authors are skipped before reading files, scanning or publishing", async () => {
  for (const authorAccess of [
    { permission: "admin", role_name: "admin" },
    { permission: "write", role_name: "write" },
    { permission: "write", role_name: "maintain" },
    { permission: "write", role_name: "custom-team-maintainer" },
  ]) {
    const { state, fetcher } = fixture({ authorAccess });
    let scanned = false;
    const scan = async () => {
      scanned = true;
      return flagged();
    };
    assert.equal(
      await checkPullRequest(event, env, fetcher, scan),
      "maintainer",
    );
    assert.equal(scanned, false);
    assert.equal(state.calls.length, 2);
    assert.ok(
      state.calls[1].pathname.endsWith("/collaborators/contributor/permission"),
    );
    assert.equal(writes(state).length, 0);
    assert.equal(state.comments.length, 0);
    assert.deepEqual(state.pull.labels, []);
  }
});

test("read, triage and outside contributor authors remain eligible", async () => {
  for (const authorAccess of [
    { permission: "none", role_name: "none" },
    { permission: "read", role_name: "read" },
    { permission: "read", role_name: "triage" },
    { permission: "read", role_name: "custom-team-reader" },
  ]) {
    const { state, fetcher } = fixture({ authorAccess });
    assert.equal(
      await checkPullRequest(event, env, fetcher, flagged),
      "flagged",
    );
    assert.deepEqual(state.pull.labels, [{ name: "slop" }]);
  }
});

test("the exclusion uses the API PR author, regardless of the triggering actor or event author", async () => {
  const changedEvent = {
    sender: { login: "maintainer" },
    pull_request: { number: 42, user: { login: "maintainer" } },
  };
  const external = fixture();
  assert.equal(
    await checkPullRequest(
      changedEvent,
      { ...env, GITHUB_ACTOR: "maintainer" },
      external.fetcher,
      flagged,
    ),
    "flagged",
  );
  assert.ok(
    external.state.calls.some((call) =>
      call.pathname.endsWith("/collaborators/contributor/permission"),
    ),
  );

  const maintainer = fixture({
    pull: { user: { login: "maintainer" } },
    authorAccess: { permission: "write", role_name: "maintain" },
  });
  assert.equal(
    await checkPullRequest(
      event,
      { ...env, GITHUB_ACTOR: "contributor" },
      maintainer.fetcher,
      flagged,
    ),
    "maintainer",
  );
  assert.ok(
    maintainer.state.calls[1].pathname.endsWith(
      "/collaborators/maintainer/permission",
    ),
  );
  assert.equal(writes(maintainer.state).length, 0);
});

test("unavailable or invalid author permissions stop the scan without mutations", async () => {
  for (const options of [
    { authorAccess: {} },
    { authorAccess: { permission: "unknown" } },
    { pull: { user: null } },
    ...[403, 404, 503].map((status) => ({
      intercept: ({ pathname, response }) =>
        pathname.endsWith("/permission") ? response({}, status) : null,
    })),
  ]) {
    const { state, fetcher } = fixture(options);
    let scanned = false;
    await assert.rejects(
      checkPullRequest(event, env, fetcher, async () => {
        scanned = true;
        return flagged();
      }),
    );
    assert.equal(scanned, false);
    assert.equal(writes(state).length, 0);
    assert.equal(
      state.calls.some((call) => call.pathname.endsWith("/files")),
      false,
    );
  }
});
