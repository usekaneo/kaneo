import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuthorizationContext,
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
});
