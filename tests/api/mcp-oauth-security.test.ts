import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertedSessions: Array<Record<string, unknown>> = [];
  const getSession = vi.fn(async ({ headers }: { headers: Headers }) => {
    const cookie = new Headers(headers).get("cookie") ?? "";
    if (cookie.includes("victim_session=1")) {
      return {
        user: { id: "victim-user" },
        session: { token: "victim-cookie-token" },
      };
    }
    return null;
  });
  const insert = vi.fn(() => ({
    values: vi.fn(async (row: Record<string, unknown>) => {
      insertedSessions.push(row);
      return row;
    }),
  }));
  const clients = new Map<
    string,
    {
      clientId: string;
      redirectUris: string[];
      clientName?: string;
      issuedAt: number;
    }
  >();
  const authorizationRequests = new Map<
    string,
    {
      clientId: string;
      codeChallenge: string;
      redirectUri: string;
      state?: string;
      expiresAt: number;
    }
  >();
  const codes = new Map<
    string,
    {
      clientId: string;
      userId: string;
      codeChallenge: string;
      redirectUri: string;
      expiresAt: number;
    }
  >();
  let nextId = 0;
  const newId = () => `oauth-test-${nextId++}`;
  const resetOAuthState = () => {
    clients.clear();
    authorizationRequests.clear();
    codes.clear();
    insertedSessions.length = 0;
  };
  return {
    authorizationRequests,
    clients,
    codes,
    getSession,
    insert,
    insertedSessions,
    newId,
    resetOAuthState,
  };
});

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("../../apps/api/src/database", () => ({
  default: { insert: mocks.insert },
}));

vi.mock("../../apps/api/src/mcp/oauth", () => ({
  registerClient: async (params: {
    redirectUris: string[];
    clientName?: string;
  }) => {
    const client = {
      clientId: mocks.newId(),
      redirectUris: [...params.redirectUris],
      clientName: params.clientName,
      issuedAt: Math.floor(Date.now() / 1000),
    };
    mocks.clients.set(client.clientId, client);
    return client;
  },
  getClient: async (clientId: string) => mocks.clients.get(clientId),
  createAuthorizationRequest: async (params: {
    clientId: string;
    codeChallenge: string;
    redirectUri: string;
    state?: string;
  }) => {
    for (const [id, request] of mocks.authorizationRequests) {
      if (request.expiresAt < Date.now()) {
        mocks.authorizationRequests.delete(id);
      }
    }
    const requestId = mocks.newId();
    mocks.authorizationRequests.set(requestId, {
      ...params,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return requestId;
  },
  getAuthorizationRequest: async (requestId: string) => {
    const request = mocks.authorizationRequests.get(requestId);
    if (!request || request.expiresAt < Date.now()) return undefined;
    return request;
  },
  consumeAuthorizationRequest: async (requestId: string) => {
    const request = mocks.authorizationRequests.get(requestId);
    if (!request || request.expiresAt < Date.now()) return undefined;
    mocks.authorizationRequests.delete(requestId);
    return request;
  },
  createAuthCode: async (params: {
    clientId: string;
    userId: string;
    codeChallenge: string;
    redirectUri: string;
  }) => {
    const code = mocks.newId();
    mocks.codes.set(code, {
      ...params,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return code;
  },
  exchangeCode: async (
    code: string,
    clientId: string,
    codeVerifier: string,
    redirectUri: string,
  ) => {
    const stored = mocks.codes.get(code);
    if (!stored) return null;
    mocks.codes.delete(code);
    const { createHash } = await import("node:crypto");
    const challenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    if (
      stored.clientId !== clientId ||
      stored.redirectUri !== redirectUri ||
      stored.expiresAt < Date.now() ||
      stored.codeChallenge !== challenge
    ) {
      return null;
    }
    const expiresIn = 30 * 24 * 60 * 60;
    await mocks.insert().values({
      id: mocks.newId(),
      token: mocks.newId(),
      userId: stored.userId,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { accessToken: mocks.newId(), expiresIn };
  },
}));

vi.mock("../../apps/api/src/mcp/tools", () => ({
  registerMcpTools: vi.fn(),
}));

import mcpRoutes from "../../apps/api/src/mcp";
import {
  createAuthorizationRequest,
  getAuthorizationRequest,
} from "../../apps/api/src/mcp/oauth";

const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
const clientOrigin = new URL(clientUrl).origin;

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function registerClient(redirectUri: string) {
  const response = await mcpRoutes.request("/mcp/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Test MCP client",
      redirect_uris: [redirectUri],
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { client_id: string };
}

function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  verifier: string,
  state: string | undefined = "client-state",
) {
  const url = new URL("http://api.local/mcp/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challengeFor(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (state !== undefined) url.searchParams.set("state", state);
  return url;
}

async function decideAuthorization(params: {
  clientId: string;
  redirectUri: string;
  verifier: string;
  approved: boolean;
  state?: string;
}) {
  const authorizeUrl = buildAuthorizeUrl(
    params.clientId,
    params.redirectUri,
    params.verifier,
    params.state,
  );
  const authorize = await mcpRoutes.request(authorizeUrl.toString(), {
    redirect: "manual",
  });
  expect(authorize.status).toBe(302);
  const consentUrl = new URL(authorize.headers.get("location") ?? "");
  const requestId = consentUrl.searchParams.get("request_id");
  expect(requestId).toBeTruthy();

  const decision = await mcpRoutes.request(
    `/mcp/authorize/request/${requestId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "victim_session=1",
        origin: clientOrigin,
      },
      body: JSON.stringify({ approved: params.approved }),
    },
  );
  expect(decision.status).toBe(200);
  const body = (await decision.json()) as { redirect: string };
  return new URL(body.redirect);
}

describe("MCP OAuth security", () => {
  beforeEach(() => {
    mocks.resetOAuthState();
  });

  it("rejects empty and unsafe redirect URI registrations", async () => {
    const empty = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [] }),
    });
    expect(empty.status).toBe(400);

    const remoteHttp = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://attacker.example/callback"],
      }),
    });
    expect(remoteHttp.status).toBe(400);
  });

  it("requires an exact registered redirect URI", async () => {
    const registeredRedirect = "https://client.example/callback";
    const client = await registerClient(registeredRedirect);
    const authorizeUrl = buildAuthorizeUrl(
      client.client_id,
      "https://attacker.example/collect",
      "verifier-for-redirect-check",
    );

    const response = await mcpRoutes.request(authorizeUrl.toString(), {
      redirect: "manual",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_redirect_uri",
    });
  });

  it("requires explicit same-origin approval before issuing a code", async () => {
    const redirectUri = "https://client.example/callback";
    const verifier = "attacker-known-verifier-1234567890";
    const client = await registerClient(redirectUri);
    const authorizeUrl = buildAuthorizeUrl(
      client.client_id,
      redirectUri,
      verifier,
    );

    const authorize = await mcpRoutes.request(authorizeUrl.toString(), {
      headers: { cookie: "victim_session=1" },
      redirect: "manual",
    });
    expect(authorize.status).toBe(302);
    const consentUrl = new URL(authorize.headers.get("location") ?? "");
    expect(consentUrl.origin).toBe(clientOrigin);
    expect(consentUrl.pathname).toBe("/mcp/authorize");
    expect(consentUrl.searchParams.has("code")).toBe(false);
    expect(mocks.getSession).not.toHaveBeenCalled();

    const requestId = consentUrl.searchParams.get("request_id");
    expect(requestId).toBeTruthy();

    const crossOriginDecision = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(crossOriginDecision.status).toBe(403);

    const unauthenticatedDecision = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(unauthenticatedDecision.status).toBe(401);

    const approval = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(approval.status).toBe(200);
    const approvalBody = (await approval.json()) as { redirect: string };
    const callback = new URL(approvalBody.redirect);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("client-state");
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await mcpRoutes.request("/mcp/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code ?? "",
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    expect(token.status).toBe(200);
    expect(mocks.insertedSessions.at(-1)?.userId).toBe("victim-user");

    const replay = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(replay.status).toBe(404);
  });

  it("preserves an explicitly empty state value", async () => {
    const redirectUri = "https://client.example/empty-state";
    const client = await registerClient(redirectUri);
    const callback = await decideAuthorization({
      clientId: client.client_id,
      redirectUri,
      verifier: "empty-state-verifier",
      approved: false,
      state: "",
    });

    expect(callback.searchParams.get("error")).toBe("access_denied");
    expect(callback.searchParams.has("state")).toBe(true);
    expect(callback.searchParams.get("state")).toBe("");
  });

  it("consumes an authorization code after a failed redemption attempt", async () => {
    const redirectUri = "https://client.example/single-use";
    const verifier = "single-use-verifier";
    const client = await registerClient(redirectUri);
    const callback = await decideAuthorization({
      clientId: client.client_id,
      redirectUri,
      verifier,
      approved: true,
    });
    const code = callback.searchParams.get("code") ?? "";

    const redeem = (codeVerifier: string) =>
      mcpRoutes.request("/mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: client.client_id,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

    expect((await redeem("incorrect-verifier")).status).toBe(400);
    expect((await redeem(verifier)).status).toBe(400);
  });

  it("sweeps expired authorization requests when creating a new one", async () => {
    const now = Date.now();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      const expiredRequestId = await createAuthorizationRequest({
        clientId: "client-expired",
        redirectUri: "https://client.example/expired",
        codeChallenge: "challenge",
      });

      vi.setSystemTime(now + 10 * 60 * 1000 + 1);
      await createAuthorizationRequest({
        clientId: "client-current",
        redirectUri: "https://client.example/current",
        codeChallenge: "challenge",
      });

      await expect(
        getAuthorizationRequest(expiredRequestId),
      ).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
