import { isLegacyRequest } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import mcpRoutes from "../../apps/api/src/mcp";
import { createModernMcpHandler } from "../../apps/api/src/mcp/modern";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ user: { id: "test-user" } })),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));

const protocolVersion = "2026-07-28";

function modernRequest(
  method: string,
  id: number,
  params: Record<string, unknown> = {},
): Request {
  const name = method === "tools/call" ? String(params.name) : undefined;
  return new Request("http://mcp.test/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: "Bearer test-token",
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": protocolVersion,
      ...(name ? { "mcp-name": name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-stateless-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

type RpcBody = {
  result: {
    tools: unknown[];
    content: Array<{ text: string }>;
  };
  error?: unknown;
};

async function rpcBody(response: Response): Promise<RpcBody> {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);
  return JSON.parse(data ?? text) as RpcBody;
}

afterEach(() => {
  vi.unstubAllGlobals();
  authMocks.getSession.mockClear();
});

describe("MCP 2026-07-28 stateless HTTP", () => {
  it("serves tools/list on independent HTTP requests without session IDs", async () => {
    const handler = createModernMcpHandler("test-token", "http://api.test");

    const first = await handler.fetch(modernRequest("tools/list", 1));
    const second = await handler.fetch(modernRequest("tools/list", 2));
    const firstBody = await rpcBody(first);
    const secondBody = await rpcBody(second);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.headers.has("mcp-session-id")).toBe(false);
    expect(second.headers.has("mcp-session-id")).toBe(false);
    expect(firstBody.result.tools).toEqual(secondBody.result.tools);
    expect(firstBody.result.tools).toContainEqual(
      expect.objectContaining({ name: "whoami" }),
    );
  });

  it("handles concurrent read-only calls with per-request authentication", async () => {
    const apiFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer test-token",
        );
        return Response.json({ user: { id: "test-user" } });
      },
    );
    vi.stubGlobal("fetch", apiFetch);
    const handler = createModernMcpHandler("test-token", "http://api.test");

    const responses = await Promise.all(
      [1, 2, 3, 4].map((id) =>
        handler.fetch(
          modernRequest("tools/call", id, {
            name: "whoami",
            arguments: {},
          }),
        ),
      ),
    );
    const bodies = await Promise.all(responses.map(rpcBody));

    expect(apiFetch).toHaveBeenCalledTimes(4);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(
      bodies.every((body) => body.result.content[0].text.includes("test-user")),
    ).toBe(true);
  });

  it("validates bearer authentication on every modern POST", async () => {
    const responses = await Promise.all(
      [1, 2].map((id) =>
        mcpRoutes.request(modernRequest("tools/list", id), undefined),
      ),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(authMocks.getSession).toHaveBeenCalledTimes(2);
    for (const call of authMocks.getSession.mock.calls) {
      expect(new Headers(call[0].headers).get("authorization")).toBe(
        "Bearer test-token",
      );
    }
  });

  it("rejects a modern request without the required per-request metadata", async () => {
    const handler = createModernMcpHandler("test-token", "http://api.test");
    const request = new Request("http://mcp.test/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-method": "tools/list",
        "mcp-protocol-version": protocolVersion,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });

    const response = await handler.fetch(request);
    const body = await rpcBody(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("executes an effectful tool on a separate request", async () => {
    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe("http://api.test/api/task/status/task-1");
        expect(init?.method).toBe("PUT");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer test-token",
        );
        expect(JSON.parse(String(init?.body))).toEqual({ status: "qa" });
        return Response.json({ id: "task-1", status: "qa" });
      },
    );
    vi.stubGlobal("fetch", apiFetch);
    const handler = createModernMcpHandler("test-token", "http://api.test");

    const response = await handler.fetch(
      modernRequest("tools/call", 1, {
        name: "update_task_status",
        arguments: { taskId: "task-1", status: "qa" },
      }),
    );
    const body = await rpcBody(response);

    expect(response.status).toBe(200);
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(body.result.content[0].text).toContain('"status": "qa"');
  });

  it("keeps legacy initialize traffic on the sessionful route", async () => {
    const legacy = new Request("http://mcp.test/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "legacy", version: "1.0.0" },
        },
      }),
    });

    expect(await isLegacyRequest(legacy)).toBe(true);
    expect(await isLegacyRequest(modernRequest("tools/list", 2))).toBe(false);
  });

  it("rejects non-POST requests before cloning for protocol classification", async () => {
    const request = new Request("http://mcp.test/mcp", {
      method: "GET",
      headers: { authorization: "Bearer test-token" },
    });
    const clone = vi.spyOn(request, "clone");

    const response = await mcpRoutes.request(request);

    expect(response.status).toBe(405);
    expect(clone).not.toHaveBeenCalled();
  });

  it("routes an existing session ID before cloning for classification", async () => {
    const request = new Request("http://mcp.test/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
        "mcp-session-id": "missing-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    const clone = vi.spyOn(request, "clone");

    const response = await mcpRoutes.request(request);

    expect(response.status).toBe(404);
    expect(clone).not.toHaveBeenCalled();
  });

  it("preserves the legacy session ID across separate requests", async () => {
    const initialize = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "legacy-test", version: "1.0.0" },
        },
      }),
    });
    const sessionId = initialize.headers.get("mcp-session-id");

    expect(initialize.status).toBe(200);
    expect(sessionId).toBeTruthy();

    const initialized = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token",
        "content-type": "application/json",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
    const tools = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token",
        "content-type": "application/json",
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    const toolsBody = await rpcBody(tools);

    expect(initialized.status).toBe(202);
    expect(tools.status).toBe(200);
    expect(toolsBody.result.tools).toContainEqual(
      expect.objectContaining({ name: "whoami" }),
    );
    expect(authMocks.getSession).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["text/plain", "text/plain"],
    ["a form post", "application/x-www-form-urlencoded"],
    ["a missing header", undefined],
  ])(
    "rejects %s with 415 before either era is dispatched",
    async (_label, contentType) => {
      const response = await mcpRoutes.request("/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          authorization: "Bearer test-token",
          ...(contentType ? { "content-type": contentType } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });

      expect(response.status).toBe(415);
    },
  );

  it("accepts a parameterised json media type", async () => {
    const response = await mcpRoutes.request("/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: "Bearer test-token",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "kaneo-test", version: "1.0.0" },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  it("returns a tool error rather than throwing when arguments fail validation", async () => {
    const handler = createModernMcpHandler("test-token", "http://api.test");

    const response = await handler.fetch(
      modernRequest("tools/call", 1, {
        name: "get_task",
        arguments: { taskId: "" },
      }),
    );
    const body = (await rpcBody(response)) as unknown as {
      result: { content: Array<{ text: string }>; isError?: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("taskId");
  });
});
