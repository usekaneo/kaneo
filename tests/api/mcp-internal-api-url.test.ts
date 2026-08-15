import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));

const protocolVersion = "2026-07-28";

function toolRequest() {
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

async function loadMcpRoutes(internalApiUrl?: string) {
  vi.stubEnv("KANEO_API_URL", "http://public.test:5273/api");
  vi.stubEnv("KANEO_INTERNAL_API_URL", internalApiUrl);
  vi.resetModules();
  return (await import("../../apps/api/src/mcp")).default;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
  authMocks.getSession.mockClear();
});

describe("MCP API URLs", () => {
  it("advertises the public URL while fetching tools through the internal URL", async () => {
    const apiFetch = vi.fn(async () =>
      Response.json({ user: { id: "test-user" } }),
    );
    vi.stubGlobal("fetch", apiFetch);
    const mcpRoutes = await loadMcpRoutes();

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

  it.each(["http://api.internal:1337/api/", "http://api.internal:1337/"])(
    "uses the configured internal URL %s without duplicate slashes",
    async (internalApiUrl) => {
      const apiFetch = vi.fn(async () =>
        Response.json({ user: { id: "test-user" } }),
      );
      vi.stubGlobal("fetch", apiFetch);
      const mcpRoutes = await loadMcpRoutes(internalApiUrl);

      const toolResponse = await mcpRoutes.request(toolRequest());

      expect(toolResponse.status).toBe(200);
      expect(apiFetch).toHaveBeenCalledOnce();
      expect(String(apiFetch.mock.calls[0]?.[0])).toBe(
        "http://api.internal:1337/api/auth/get-session",
      );
    },
  );
});
