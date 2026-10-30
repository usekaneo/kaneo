import { isLegacyRequest } from "@modelcontextprotocol/server";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import mcpRoutes from "../../apps/api/src/mcp/index";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(async (): Promise<{ user: { id: string } } | null> => ({
    user: { id: "test-user" },
  })),
}));

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: authMocks.getSession } },
}));
vi.mock("@modelcontextprotocol/server", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@modelcontextprotocol/server")>();
  return { ...original, isLegacyRequest: vi.fn(original.isLegacyRequest) };
});
import {
  MCP_BODY_BYTES,
  mcpRequestBounds,
  OAUTH_BODY_BYTES,
  OAUTH_MAX_IN_FLIGHT,
  oauthRequestBounds,
} from "../../apps/api/src/mcp/request-bounds";

const parse = vi.fn(async (text: string) => text);
const app = new Hono().post("/register", oauthRequestBounds, async (c) =>
  c.text(await parse(await c.req.text())),
);
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  authMocks.getSession
    .mockReset()
    .mockResolvedValue({ user: { id: "test-user" } });
});

describe("MCP bounded body admission", () => {
  const parseMcp = vi.fn(async (text: string) => text);
  const mcpApp = new Hono().post("/mcp", mcpRequestBounds, async (c) =>
    c.text(await parseMcp(await c.req.text())),
  );

  it.each([
    ["missing content length", undefined],
    ["misleading small content length", "1"],
  ])(
    "rejects actual oversized bytes with %s",
    async (_label, contentLength) => {
      const body =
        JSON.stringify({ jsonrpc: "2.0", method: "initialize" }) +
        " ".repeat(MCP_BODY_BYTES);
      const response = await mcpApp.request(
        new Request("http://localhost/mcp", {
          method: "POST",
          headers: contentLength ? { "content-length": contentLength } : {},
          body,
        }),
      );
      expect(response.status).toBe(413);
      expect(parseMcp).not.toHaveBeenCalled();
    },
  );

  it("cancels a streamed overflow before parser invocation", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MCP_BODY_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
      cancel,
    });
    const response = await mcpApp.request(
      new Request("http://localhost/mcp", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(parseMcp).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared content length before reading", async () => {
    const read = vi.fn();
    const body = new ReadableStream({ pull: read }, { highWaterMark: 0 });
    const response = await mcpApp.request(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "content-length": String(MCP_BODY_BYTES + 1) },
        body,
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(read).not.toHaveBeenCalled();
    expect(parseMcp).not.toHaveBeenCalled();
  });

  it("uses a deadline and cancels a stream that never completes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream({ start() {}, cancel });
    const pending = mcpApp.request(
      new Request("http://localhost/mcp", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(5_001);
    expect((await pending).status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(parseMcp).not.toHaveBeenCalled();
  });

  it("accepts the exact byte boundary", async () => {
    const body = "x".repeat(MCP_BODY_BYTES);
    const response = await mcpApp.request("/mcp", { method: "POST", body });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });

  it("rejects oversized authenticated route input before protocol classification", async () => {
    const classify = vi.mocked(isLegacyRequest);
    const api = new Hono().route("/api", mcpRoutes);
    authMocks.getSession.mockClear();
    const bytes = new Uint8Array(MCP_BODY_BYTES + 1);
    const request = new Request("http://mcp.test/api/mcp", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "content-type": "application/json",
      },
      body: bytes,
    });
    const response = await api.request(request);
    expect(response.status).toBe(413);
    expect(authMocks.getSession).toHaveBeenCalledOnce();
    expect(classify).not.toHaveBeenCalled();
  });

  it.each([
    ["missing Authorization", undefined, 0],
    ["invalid Bearer token", "Bearer invalid-test-token", 1],
  ] as const)(
    "rejects %s before reading request bytes",
    async (_name, authorization, lookups) => {
      if (authorization) authMocks.getSession.mockResolvedValueOnce(null);
      const pull = vi.fn();
      const body = new ReadableStream({ pull }, { highWaterMark: 0 });
      const request = new Request("http://mcp.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
        },
        body,
        duplex: "half",
      } as RequestInit);
      try {
        const response = await mcpRoutes.request(request);
        expect(response.status).toBe(401);
        expect(authMocks.getSession).toHaveBeenCalledTimes(lookups);
        expect(pull).not.toHaveBeenCalled();
        expect(request.bodyUsed).toBe(false);
      } finally {
        await body.cancel();
      }
    },
  );
});

describe("OAuth bounded body reader", () => {
  it("cancels an over-limit chunked stream without invoking the parser", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(16 * 1024));
      },
      cancel,
    });
    const response = await app.request(
      new Request("http://localhost/register", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
    );
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });
  it("accepts a body exactly at the byte limit", async () => {
    const body = "x".repeat(OAUTH_BODY_BYTES);
    const response = await app.request("/register", { method: "POST", body });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });
  it("bounds simultaneous slow requests and releases capacity after their deadlines", async () => {
    vi.useFakeTimers();
    const pending = Array.from({ length: OAUTH_MAX_IN_FLIGHT }, () =>
      app.request(
        new Request("http://localhost/register", {
          method: "POST",
          body: new ReadableStream(),
          duplex: "half",
        } as RequestInit),
      ),
    );
    const denied = await app.request("/register", {
      method: "POST",
      body: "small",
    });
    expect(denied.status).toBe(429);
    expect(denied.headers.get("retry-after")).toBe("1");
    await vi.advanceTimersByTimeAsync(5_001);
    expect(
      (await Promise.all(pending)).every((response) => response.status === 408),
    ).toBe(true);
    expect(
      (await app.request("/register", { method: "POST", body: "small" }))
        .status,
    ).toBe(200);
  });

  it("uses a deadline for a stream that never finishes", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const body = new ReadableStream({ start() {}, cancel });
    const pending = app.request(
      new Request("http://localhost/register", {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit),
    );
    await vi.advanceTimersByTimeAsync(5_001);
    expect((await pending).status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(parse).not.toHaveBeenCalled();
  });
});
