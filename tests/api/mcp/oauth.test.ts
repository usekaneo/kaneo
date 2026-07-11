import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mcp from "../../../apps/api/src/mcp";
import {
  createAuthorizationContext,
  registerClient,
  verifyAuthorizationContext,
} from "../../../apps/api/src/mcp/oauth";

describe("MCP authorization context", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret-with-at-least-32-characters");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips signed authorization state", () => {
    const token = createAuthorizationContext({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:3000/callback",
      codeChallenge: "challenge",
      state: "state-1",
    });

    expect(verifyAuthorizationContext(token)).toMatchObject({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:3000/callback",
      codeChallenge: "challenge",
      state: "state-1",
    });
  });

  it("rejects tampered authorization state", () => {
    const token = createAuthorizationContext({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:3000/callback",
      codeChallenge: "challenge",
    });
    const [payload, signature] = token.split(".");

    expect(verifyAuthorizationContext(`${payload}x.${signature}`)).toBeNull();
  });

  it("fails closed when the authorization secret is missing", () => {
    vi.stubEnv("AUTH_SECRET", "");

    expect(() =>
      createAuthorizationContext({
        clientId: "client-1",
        redirectUri: "http://127.0.0.1:3000/callback",
        codeChallenge: "challenge",
      }),
    ).toThrow("AUTH_SECRET is required");
  });

  it("rejects authorization for an unregistered redirect URI", async () => {
    const client = registerClient({
      redirectUris: ["http://127.0.0.1:3000/callback"],
    });
    const response = await mcp.request(
      `/mcp/authorize?client_id=${client.clientId}&redirect_uri=http%3A%2F%2F127.0.0.1%3A3001%2Fcallback&code_challenge=challenge`,
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid and expired callback contexts", async () => {
    const invalidResponse = await mcp.request("/mcp/authorize/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: "token",
        authorization_context: "invalid.context",
      }),
    });
    expect(invalidResponse.status).toBe(400);

    vi.useFakeTimers();
    const context = createAuthorizationContext({
      clientId: "client-1",
      redirectUri: "http://127.0.0.1:3000/callback",
      codeChallenge: "challenge",
    });
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);

    const expiredResponse = await mcp.request("/mcp/authorize/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: "token",
        authorization_context: context,
      }),
    });
    expect(expiredResponse.status).toBe(400);
    vi.useRealTimers();
  });
});
