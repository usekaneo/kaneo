import { createHash } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db from "../../apps/api/src/database";
import { mcpOauthStateTable } from "../../apps/api/src/database/schema";
import mcp from "../../apps/api/src/mcp";
import {
  createAuthorizationRequest,
  getAuthorizationRequest,
  registerClient,
} from "../../apps/api/src/mcp/oauth";
import { OAUTH_STATE_LIMITS } from "../../apps/api/src/mcp/oauth-store";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const redirectUri = "https://client.example/callback";
const challenge = createHash("sha256")
  .update("test-verifier")
  .digest("base64url");
beforeEach(async () => {
  await resetTestDatabase();
});
async function total(kind: string) {
  const [row] = await db
    .select({ total: count() })
    .from(mcpOauthStateTable)
    .where(eq(mcpOauthStateTable.kind, kind));
  return row.total;
}
function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return mcp.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("MCP OAuth HTTP resource bounds", () => {
  it.each([
    { redirect_uris: Array.from({ length: 11 }, () => redirectUri) },
    { redirect_uris: [redirectUri], client_name: "x".repeat(101) },
    { redirect_uris: [`https://example.com/${"x".repeat(2048)}`] },
  ])(
    "rejects oversized registration fields before storing them: %j",
    async (body) => {
      expect((await post("/mcp/register", body)).status).toBe(400);
      expect(await total("client")).toBe(0);
    },
  );

  it("rejects a large actual body even with a misleading Content-Length", async () => {
    const response = await post(
      "/mcp/register",
      { redirect_uris: [redirectUri], ignored: "x".repeat(33 * 1024) },
      { "content-length": "1" },
    );
    expect(response.status).toBe(413);
    expect(await total("client")).toBe(0);
  });

  it("bounds authorization fields and the raw URL before any request row is created", async () => {
    const client = await registerClient({ redirectUris: [redirectUri] });
    for (const [field, value, status] of [
      ["state", "s".repeat(1025), 400],
      ["state", "s".repeat(9000), 414],
      ["code_challenge", "x".repeat(44), 400],
      ["client_id", "x".repeat(129), 400],
    ] as const) {
      const query = new URLSearchParams({
        response_type: "code",
        client_id: client.clientId,
        redirect_uri: redirectUri,
        code_challenge: challenge,
        code_challenge_method: "S256",
        [field]: value,
      });
      expect((await mcp.request(`/mcp/authorize?${query}`)).status).toBe(
        status,
      );
    }
    expect(await total("request")).toBe(0);
    const query = new URLSearchParams({
      response_type: "code",
      client_id: client.clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "s".repeat(1024),
    });
    expect((await mcp.request(`/mcp/authorize?${query}`)).status).toBe(302);
    expect(await total("request")).toBe(1);
  });

  it("returns a retryable JSON error at the durable registration limit", async () => {
    await db.insert(mcpOauthStateTable).values({
      kind: "rate",
      key: "client",
      payload: { count: OAUTH_STATE_LIMITS.client.perMinute },
      expiresAt: new Date(Date.now() + 60_000),
    });
    const response = await post("/mcp/register", {
      redirect_uris: [redirectUri],
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toHaveProperty(
      "error",
      "temporarily_unavailable",
    );
    expect(await total("client")).toBe(0);
  });

  it("allows retrying consent after capacity recovers without issuing multiple codes", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const client = await registerClient({ redirectUris: [redirectUri] });
    const id = await createAuthorizationRequest({
      clientId: client.clientId,
      codeChallenge: challenge,
      redirectUri,
    });
    await db.insert(mcpOauthStateTable).values({
      kind: "rate",
      key: "code",
      payload: { count: OAUTH_STATE_LIMITS.code.perMinute },
      expiresAt: new Date(Date.now() + 60_000),
    });
    const approve = () =>
      post(
        `/mcp/authorize/request/${id}`,
        { approved: true },
        { origin: "http://localhost:5173" },
      );
    expect((await approve()).status).toBe(429);
    expect(await getAuthorizationRequest(id)).not.toBeNull();
    await db
      .delete(mcpOauthStateTable)
      .where(
        and(
          eq(mcpOauthStateTable.kind, "rate"),
          eq(mcpOauthStateTable.key, "code"),
        ),
      );
    expect((await approve()).status).toBe(200);
    expect(await getAuthorizationRequest(id)).toBeNull();
    expect((await approve()).status).toBe(404);
    expect(await total("code")).toBe(1);
  });

  it.each([
    null,
    [],
    {
      grant_type: "authorization_code",
      code: {},
      client_id: "x",
      code_verifier: "x",
      redirect_uri: redirectUri,
    },
  ])("returns400 for malformed token inputs: %j", async (input) => {
    expect((await post("/mcp/token", input)).status).toBe(400);
  });
});
