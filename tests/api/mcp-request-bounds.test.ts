import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
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
