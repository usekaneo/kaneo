import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import {
  authorizeClient,
  completeClientAuthorization,
} from "./controllers/authorize-client";
import { exchangeCode, registerClient } from "./oauth";
import { registerMcpTools } from "./tools";

const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
const apiUrl = (process.env.KANEO_API_URL || "http://localhost:1337").replace(
  /\/api\/?$/,
  "",
);

const sessions = new Map<string, WebStandardStreamableHTTPServerTransport>();

const redirectUriSchema = v.pipe(v.string(), v.nonEmpty(), v.url());
const registerClientSchema = v.object({
  redirect_uris: v.pipe(v.array(redirectUriSchema), v.minLength(1)),
  client_name: v.optional(v.pipe(v.string(), v.nonEmpty())),
  token_endpoint_auth_method: v.optional(v.literal("none")),
  grant_types: v.optional(v.tuple([v.literal("authorization_code")])),
  response_types: v.optional(v.tuple([v.literal("code")])),
});
const authorizeQuerySchema = v.object({
  client_id: v.pipe(v.string(), v.nonEmpty()),
  redirect_uri: redirectUriSchema,
  code_challenge: v.pipe(v.string(), v.nonEmpty()),
  state: v.optional(v.string()),
});
const authorizeCallbackSchema = v.object({
  access_token: v.pipe(v.string(), v.nonEmpty()),
  authorization_context: v.pipe(v.string(), v.nonEmpty()),
});

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

mcp.post(
  "/mcp/register",
  describeRoute({
    operationId: "registerMcpClient",
    tags: ["MCP"],
    description: "Register an OAuth client for MCP access",
    responses: {
      200: { description: "OAuth client registered successfully" },
      400: { description: "Invalid client metadata" },
    },
  }),
  validator("json", registerClientSchema),
  async (c) => {
    const body = c.req.valid("json");
    const client = registerClient({
      redirectUris: body.redirect_uris,
      clientName: body.client_name,
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
  },
);

mcp.get(
  "/mcp/authorize",
  describeRoute({
    operationId: "authorizeMcpClient",
    tags: ["MCP"],
    description: "Authorize a registered MCP OAuth client",
    responses: {
      302: { description: "Redirect to the client or device authorization" },
      400: { description: "Invalid authorization request" },
    },
  }),
  validator("query", authorizeQuerySchema),
  async (c) => {
    const {
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      state,
    } = c.req.valid("query");

    const result = await authorizeClient(
      { clientId, redirectUri, codeChallenge, state },
      c.req.raw.headers,
      apiUrl,
    );
    if (result.type === "redirect") {
      return c.redirect(result.redirect);
    }

    const { device, authorizationContext } = result;
    const devicePageUrl = `${clientUrl}/device?user_code=${encodeURIComponent(device.user_code)}`;

    return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kaneo MCP</title>
  <script>window.location.href = ${JSON.stringify(devicePageUrl)};</script>
</head>
<body>Redirecting to Kaneo…</body>
<script>
  const deviceCode = ${JSON.stringify(device.device_code)};
  const interval = ${device.interval} * 1000;
  const apiUrl = ${JSON.stringify(apiUrl)};
  const authorizationContext = ${JSON.stringify(authorizationContext)};

  async function poll() {
    try {
      const res = await fetch(apiUrl + "/api/auth/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: deviceCode,
          client_id: "kaneo-mcp"
        }),
        signal: AbortSignal.timeout(10000)
      });
      const data = await res.json();

      if (res.ok && data.access_token) {
        const codeRes = await fetch(apiUrl + "/api/mcp/authorize/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: data.access_token,
            authorization_context: authorizationContext
          }),
          signal: AbortSignal.timeout(10000)
        });
        const codeData = await codeRes.json();
        if (codeData.redirect) window.location.href = codeData.redirect;
        return;
      }

      if (data.error === "authorization_pending" || data.error === "slow_down") {
        setTimeout(poll, data.error === "slow_down" ? interval + 5000 : interval);
        return;
      }
    } catch {
      setTimeout(poll, interval);
    }
  }

  setTimeout(poll, interval);
</script>
</html>`);
  },
);

mcp.post(
  "/mcp/authorize/callback",
  describeRoute({
    operationId: "completeMcpAuthorization",
    tags: ["MCP"],
    description: "Complete device authorization for an MCP OAuth client",
    responses: {
      200: { description: "Authorization completed successfully" },
      400: { description: "Invalid authorization context" },
      401: { description: "Invalid access token" },
    },
  }),
  validator("json", authorizeCallbackSchema),
  async (c) => {
    const { access_token, authorization_context } = c.req.valid("json");
    const redirect = await completeClientAuthorization(
      access_token,
      authorization_context,
    );
    return c.json({ redirect });
  },
);

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
