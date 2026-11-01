import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import { verifyGithubOidc } from "./verify-github-oidc";

let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let jwks: ReturnType<typeof createLocalJWKSet>;
const expected = {
  audience: "https://kaneo.example",
  repository: "acme/widget",
  repositoryId: 42,
  runId: "123",
  workflowRef: "acme/widget/.github/workflows/kaneo-agent.yml@refs/heads/main",
  workflowSha: "a".repeat(40),
};
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(keys.publicKey)), kid: "test", alg: "RS256" }],
  });
});
async function token(extra: Record<string, unknown> = {}, expired = false) {
  return new SignJWT({
    repository: expected.repository,
    repository_id: "42",
    run_id: "123",
    run_attempt: "1",
    event_name: "workflow_dispatch",
    workflow_ref: expected.workflowRef,
    workflow_sha: expected.workflowSha,
    ...extra,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuer(
      typeof extra.iss === "string"
        ? extra.iss
        : "https://token.actions.githubusercontent.com",
    )
    .setAudience(expected.audience)
    .setSubject("repo:acme/widget:ref:refs/heads/main")
    .setJti("unique")
    .setIssuedAt()
    .setNotBefore("0s")
    .setExpirationTime(expired ? "-1m" : "5m")
    .sign(keys.privateKey);
}
describe("GitHub job OIDC", () => {
  it("verifies a signed token bound to the dispatched workflow", async () => {
    await expect(
      verifyGithubOidc(await token(), expected, jwks),
    ).resolves.toBeUndefined();
  });
  it.each([
    { repository: "other/repo" },
    { repository_id: "99" },
    { run_id: "124" },
    { run_attempt: "2" },
    { workflow_ref: "acme/widget/.github/workflows/evil.yml@refs/heads/main" },
    { workflow_sha: "b".repeat(40) },
    { event_name: "pull_request" },
  ])("rejects mismatched identity %j", async (extra) => {
    await expect(
      verifyGithubOidc(await token(extra), expected, jwks),
    ).rejects.toThrow();
  });
  it("rejects expiry, wrong issuer, and audience", async () => {
    await expect(
      verifyGithubOidc(await token({}, true), expected, jwks),
    ).rejects.toThrow();
    await expect(
      verifyGithubOidc(
        await token(),
        { ...expected, audience: "elsewhere" },
        jwks,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGithubOidc(
        await token({ iss: "https://evil.example" }),
        expected,
        jwks,
      ),
    ).rejects.toThrow();
  });
});
