import { afterEach, describe, expect, it, vi } from "vitest";
import { KaneoClient } from "./client.js";

describe("KaneoClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("adds auth and json headers for requests with a body", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token-123"),
      clearToken: vi.fn().mockResolvedValue(undefined),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new KaneoClient({
      baseUrl: "https://api.example.com",
      auth: auth as never,
    });

    await expect(
      client.json("/api/project", {
        method: "POST",
        body: JSON.stringify({ name: "Inbox" }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("clears the cached token and retries once after a 401", async () => {
    const auth = {
      getAccessToken: vi
        .fn()
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("fresh-token"),
      clearToken: vi.fn().mockResolvedValue(undefined),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task-1" }), { status: 200 }),
      );
    globalThis.fetch = fetchMock as typeof fetch;

    const client = new KaneoClient({
      baseUrl: "https://api.example.com",
      auth: auth as never,
    });

    await expect(client.json("/api/task/task-1")).resolves.toEqual({
      id: "task-1",
    });
    expect(auth.clearToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces api error messages when a request fails", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token-123"),
      clearToken: vi.fn().mockResolvedValue(undefined),
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Task not found" }), {
        status: 404,
      }),
    ) as typeof fetch;

    const client = new KaneoClient({
      baseUrl: "https://api.example.com",
      auth: auth as never,
    });

    await expect(client.json("/api/task/missing")).rejects.toThrow(
      "/api/task/missing: Task not found",
    );
  });
});
