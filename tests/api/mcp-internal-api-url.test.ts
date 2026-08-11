import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("KANEO_API_URL", "http://public.test:5273/api");
  vi.stubEnv("KANEO_INTERNAL_API_URL", undefined);
});

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));

import mcpRoutes from "../../apps/api/src/mcp";

const protocolVersion = "2026-07-28";

function toolRequest(): Request {
  return new Request("http://public.test:5273/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: "Bearer test-token",
      "content-type": "application/json",
      "mcp-method": "tools/call",
      "mcp-name": "whoami",
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "whoami",
        arguments: {},
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-internal-url-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  authMocks.getSession.mockClear();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("MCP API URLs", () => {
  it("advertises the public URL while fetching tools through the internal URL", async () => {
    const apiFetch = vi.fn(async () =>
      Response.json({ user: { id: "test-user" } }),
    );
    vi.stubGlobal("fetch", apiFetch);

    const metadataResponse = await mcpRoutes.request(
      "/.well-known/oauth-authorization-server/api",
    );
    const metadata = (await metadataResponse.json()) as {
      issuer: string;
      authorization_endpoint: string;
    };

    expect(metadata).toMatchObject({
      issuer: "http://public.test:5273/api",
      authorization_endpoint: "http://public.test:5273/api/mcp/authorize",
    });

    const toolResponse = await mcpRoutes.request(toolRequest());

    expect(toolResponse.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(String(apiFetch.mock.calls[0]?.[0])).toBe(
      "http://127.0.0.1:1337/api/auth/get-session",
    );
  });
});
