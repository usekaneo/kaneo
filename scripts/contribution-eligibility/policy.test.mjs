import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessIssues, authorExemption, validatePolicy } from "./policy.mjs";

const account = {
  id: 123,
  login: "trusted",
  reason: "Reviewed contributions.",
};
const policy = {
  vouchedContributors: [account],
  exemptBots: [{ ...account, id: 456 }],
};
const author = { id: 123, login: "trusted", type: "User" };

test("checked-in policy is valid and explicitly exempts only Dependabot initially", async () => {
  const current = validatePolicy(
    JSON.parse(
      await readFile(
        new URL("../../.github/contribution-policy.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.deepEqual(
    current.exemptBots.map((entry) => entry.id),
    [49699333],
  );
});

test("vouchers follow account IDs through renames, never reused usernames", () => {
  assert.ok(authorExemption({ ...author, login: "renamed" }, null, policy));
  assert.equal(authorExemption({ ...author, id: 999 }, null, policy), null);
  assert.equal(
    authorExemption(author, null, { ...policy, vouchedContributors: [] }),
    null,
  );
});

test("only explicit bots are exempt; human and bot vouchers cannot be exchanged", () => {
  assert.ok(authorExemption({ ...author, id: 456, type: "Bot" }, null, policy));
  assert.equal(
    authorExemption(
      { ...author, type: "Bot" },
      { permission: "admin" },
      policy,
    ),
    null,
  );
  assert.equal(authorExemption({ ...author, id: 456 }, null, policy), null);
});

test("maintainer permissions are checked rather than contributor association", () => {
  const newcomer = { ...author, id: 999, author_association: "MEMBER" };
  for (const permission of [
    { permission: "admin", role_name: "admin" },
    { permission: "write", role_name: "maintain" },
    { permission: "maintain" },
  ])
    assert.ok(authorExemption(newcomer, permission, policy));
  for (const permission of [
    null,
    { permission: "write", role_name: "write" },
    { permission: "triage" },
    { permission: "read" },
  ]) {
    assert.equal(authorExemption(newcomer, permission, policy), null);
  }
});

test("policy rejects missing lists, ambiguous identities and undocumented grants", () => {
  for (const invalid of [
    null,
    {},
    { exemptBots: [] },
    { ...policy, vouchedContributors: null },
  ]) {
    assert.throws(() => validatePolicy(invalid));
  }
  for (const invalid of [
    { id: "123" },
    { id: 0 },
    { id: -1 },
    { id: 1.5 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
    { login: "" },
    { reason: " " },
  ]) {
    assert.throws(() =>
      validatePolicy({
        ...policy,
        vouchedContributors: [{ ...account, ...invalid }],
      }),
    );
  }
  assert.throws(() => validatePolicy({ ...policy, exemptBots: [account] }));
  assert.throws(() => authorExemption({}, null, policy));
});

test("an existing open approved issue is required; one valid link suffices", () => {
  const approved = {
    number: 12,
    state: "open",
    labels: [{ name: "ready-for-contribution" }],
  };
  assert.equal(assessIssues([approved]).state, "success");
  for (const issues of [
    [],
    [{ ...approved, state: "closed" }],
    [{ ...approved, labels: [] }],
    [{ ...approved, labels: [{ name: "good first issue" }] }],
    [{ ...approved, pull_request: { url: "https://example.invalid" } }],
  ])
    assert.equal(assessIssues(issues).state, "failure");
  assert.equal(
    assessIssues([{ ...approved, state: "closed" }, approved]).state,
    "success",
  );
});
