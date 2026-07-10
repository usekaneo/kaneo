import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { auth } from "../auth";
import {
  consumeAuthorizationRequest,
  createAuthCode,
  createAuthorizationRequest,
  exchangeCode,
  getAuthorizationRequest,
  getClient,
  registerClient,
} from "./oauth";
import { registerMcpTools } from "./tools";

const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
const apiUrl = (process.env.KANEO_API_URL || "http://localhost:1337").replace(
  /\/api\/?$/,
  "",
);

const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

function isValidRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;

  try {
    const url = new URL(value);
    if (url.hash || url.username || url.password) return false;
    if (["javascript:", "data:", "file:", "vbscript:"].includes(url.protocol)) {
      return false;
    }
    if (url.protocol === "http:") {
      return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    }
    return (
      url.protocol === "https:" || /^[a-z][a-z0-9+.-]*:$/.test(url.protocol)
    );
  } catch {
    return false;
  }
}

function isTrustedConsentOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(clientUrl).origin;
  } catch {
    return false;
  }
}

function buildAuthorizationRedirect(
  request: { redirectUri: string; state?: string },
  params: Record<string, string>,
): string {
  const url = new URL(request.redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (request.state) url.searchParams.set("state", request.state);
  return url.toString();
}

function createMcpServerForUser(token: string): McpServer {
  const server = new McpServer({
    name: "kaneo-mcp",
    version: "1.0.0",
  });
  registerMcpTools(server, apiUrl, token);
  return server;
}

async function validateBearerToken(
  req: Request,
): Promise<{ userId: string; token: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match?.[1]) return null;
  const token = match[1];

  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  const session = await auth.api.getSession({ headers });

  if (!session?.user?.id) return null;
  return { userId: session.user.id, token };
}

const mcp = new Hono();

mcp.post("/mcp/register", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const redirectUris = body?.redirect_uris;
  if (
    !body ||
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every(isValidRedirectUri)
  ) {
    return c.json({ error: "invalid_redirect_uris" }, 400);
  }
  if (
    (body.token_endpoint_auth_method !== undefined &&
      body.token_endpoint_auth_method !== "none") ||
    (body.grant_types !== undefined &&
      (!Array.isArray(body.grant_types) ||
        body.grant_types.length !== 1 ||
        body.grant_types[0] !== "authorization_code")) ||
    (body.response_types !== undefined &&
      (!Array.isArray(body.response_types) ||
        body.response_types.length !== 1 ||
        body.response_types[0] !== "code"))
  ) {
    return c.json({ error: "invalid_client_metadata" }, 400);
  }

  const client = registerClient({
    redirectUris,
    clientName:
      typeof body.client_name === "string"
        ? body.client_name.slice(0, 100)
        : undefined,
  });
  return c.json({
    client_id: client.clientId,
    client_id_issued_at: client.issuedAt,
    redirect_uris: client.redirectUris,
    client_name: client.clientName,
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
    grant_types: body.grant_types ?? ["authorization_code"],
    response_types: body.response_types ?? ["code"],
  });
});

mcp.get("/mcp/authorize", async (c) => {
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");
  const responseType = c.req.query("response_type");
  const state = c.req.query("state");

  if (
    !clientId ||
    !redirectUri ||
    !codeChallenge ||
    codeChallengeMethod !== "S256" ||
    responseType !== "code"
  ) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const client = getClient(clientId);
  if (!client) {
    return c.json({ error: "invalid_client" }, 400);
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return c.json({ error: "invalid_redirect_uri" }, 400);
  }

  const requestId = createAuthorizationRequest({
    clientId,
    codeChallenge,
    redirectUri,
    state,
  });
  const consentUrl = new URL("/mcp/authorize", clientUrl);
  consentUrl.searchParams.set("request_id", requestId);
  return c.redirect(consentUrl.toString());
});

mcp.get("/mcp/authorize/request/:requestId", (c) => {
  const request = getAuthorizationRequest(c.req.param("requestId"));
  if (!request) {
    return c.json({ error: "invalid_or_expired_request" }, 404);
  }
  const client = getClient(request.clientId);
  if (!client) return c.json({ error: "invalid_client" }, 400);

  return c.json({
    client_name: client.clientName ?? "MCP client",
    redirect_uri: request.redirectUri,
  });
});

mcp.post("/mcp/authorize/request/:requestId", async (c) => {
  if (!isTrustedConsentOrigin(c.req.raw)) {
    return c.json({ error: "invalid_origin" }, 403);
  }

  const body = (await c.req.json().catch(() => null)) as {
    approved?: unknown;
  } | null;
  if (typeof body?.approved !== "boolean") {
    return c.json({ error: "invalid_request" }, 400);
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user?.id) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const request = consumeAuthorizationRequest(c.req.param("requestId"));
  if (!request) {
    return c.json({ error: "invalid_or_expired_request" }, 404);
  }
  const client = getClient(request.clientId);
  if (!client || !client.redirectUris.includes(request.redirectUri)) {
    return c.json({ error: "invalid_client" }, 400);
  }

  if (!body.approved) {
    return c.json({
      redirect: buildAuthorizationRedirect(request, {
        error: "access_denied",
      }),
    });
  }

  const code = createAuthCode({
    clientId: request.clientId,
    userId: session.user.id,
    codeChallenge: request.codeChallenge,
    redirectUri: request.redirectUri,
  });
  return c.json({
    redirect: buildAuthorizationRedirect(request, { code }),
  });
});

mcp.post("/mcp/token", async (c) => {
  const contentType = c.req.header("content-type") || "";
  let params: Record<string, string>;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await c.req.text();
    params = Object.fromEntries(new URLSearchParams(body));
  } else {
    params = await c.req.json();
  }

  const { grant_type, code, client_id, code_verifier, redirect_uri } = params;

  if (grant_type !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }
  if (!code || !client_id || !code_verifier || !redirect_uri) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const result = await exchangeCode(
    code,
    client_id,
    code_verifier,
    redirect_uri,
  );
  if (!result) {
    return c.json({ error: "invalid_grant" }, 400);
  }

  return c.json({
    access_token: result.accessToken,
    token_type: "bearer",
    expires_in: result.expiresIn,
  });
});

mcp.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
  c.json({
    resource: `${apiUrl}/api/mcp`,
    authorization_servers: [`${apiUrl}/api`],
  }),
);

mcp.get("/.well-known/oauth-authorization-server/api", (c) =>
  c.json({
    issuer: `${apiUrl}/api`,
    authorization_endpoint: `${apiUrl}/api/mcp/authorize`,
    token_endpoint: `${apiUrl}/api/mcp/token`,
    registration_endpoint: `${apiUrl}/api/mcp/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  }),
);

mcp.all("/mcp", async (c) => {
  const authResult = await validateBearerToken(c.req.raw);
  if (!authResult) {
    const prmUrl = `${apiUrl}/api/.well-known/oauth-protected-resource/api/mcp`;
    c.header("WWW-Authenticate", `Bearer resource_metadata="${prmUrl}"`);
    return c.json(
      {
        error: "invalid_token",
        error_description: "Missing or invalid token",
      },
      401,
    );
  }

  const sessionId = c.req.header("mcp-session-id");

  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing) {
      return existing.handleRequest(c.req.raw);
    }
    return c.json({ error: "Session not found" }, 404);
  }

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  const server = createMcpServerForUser(authResult.token);
  await server.connect(transport);
  const response = await transport.handleRequest(c.req.raw);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, transport);
  }

  return response;
});

export default mcp;

export function mcpWellKnownRoutes(baseUrl: string) {
  const wellKnown = new Hono();

  wellKnown.get("/.well-known/oauth-protected-resource/api/mcp", (c) =>
    c.json({
      resource: `${baseUrl}/api/mcp`,
      authorization_servers: [`${baseUrl}/api`],
    }),
  );

  wellKnown.get("/.well-known/oauth-authorization-server/api", (c) =>
    c.json({
      issuer: `${baseUrl}/api`,
      authorization_endpoint: `${baseUrl}/api/mcp/authorize`,
      token_endpoint: `${baseUrl}/api/mcp/token`,
      registration_endpoint: `${baseUrl}/api/mcp/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    }),
  );

  return wellKnown;
}
