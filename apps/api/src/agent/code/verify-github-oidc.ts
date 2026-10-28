import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const issuer = "https://token.actions.githubusercontent.com";
const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`), {
  timeoutDuration: 5000,
  cooldownDuration: 30000,
  cacheMaxAge: 600000,
});

export async function verifyGithubOidc(
  token: string,
  expected: {
    audience: string;
    repository: string;
    repositoryId: number;
    runId: string;
    workflowRef: string;
    workflowSha: string;
  },
  key: JWTVerifyGetKey = keys,
) {
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience: expected.audience,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "nbf", "sub", "jti"],
    maxTokenAge: "10m",
  });
  if (
    payload.repository !== expected.repository ||
    payload.repository_id !== String(expected.repositoryId) ||
    payload.run_id !== expected.runId ||
    payload.run_attempt !== "1" ||
    payload.event_name !== "workflow_dispatch" ||
    payload.workflow_ref !== expected.workflowRef ||
    payload.workflow_sha !== expected.workflowSha
  )
    throw new Error("Invalid GitHub job identity");
}
