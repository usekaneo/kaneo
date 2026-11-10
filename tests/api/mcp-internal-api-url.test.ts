import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  authMocks.getSession.mockClear();
});

describe.each([
  undefined,
  "http://api.internal:1337/api/",
  "http://api.internal:1337/",
])("MCP API URLs with internal URL %s", (internalApiUrl) => {
  let mcpRoutes: typeof import("../../apps/api/src/mcp").default;
  const apiFetch = vi.fn(async (_input: RequestInfo | URL) =>
    Response.json({
      user: {
        id: "test-user",
        name: "Test User",
        email: "test@example.com",
      },
    }),
  );

  beforeEach(async () => {
    apiFetch.mockClear();
    vi.stubGlobal("fetch", apiFetch);
    vi.stubEnv("KANEO_API_URL", "http://public.test:5273/api");
    vi.stubEnv("KANEO_INTERNAL_API_URL", internalApiUrl);
    vi.resetModules();
    // Load the isolated route graph during setup, outside the request's test timeout.
    mcpRoutes = (await import("../../apps/api/src/mcp")).default;
  });

  it("advertises the public URL and fetches through the internal URL without duplicate slashes", async () => {
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
    await toolResponse.text();

    expect(toolResponse.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(String(apiFetch.mock.calls[0]?.[0])).toBe(
      internalApiUrl
        ? "http://api.internal:1337/api/auth/get-session"
        : "http://127.0.0.1:1337/api/auth/get-session",
    );
  });
});
