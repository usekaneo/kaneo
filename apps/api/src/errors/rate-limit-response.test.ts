import { describe, expect, it } from "vite-plus/test";
import { withJsonRateLimit } from "./rate-limit-response";

describe("withJsonRateLimit", () => {
  it("adds the code to a message-only 429 and keeps its headers", async () => {
    const response = await withJsonRateLimit(
      new Response(
        JSON.stringify({
          message: "Too many requests. Please try again later.",
        }),
        { status: 429, headers: { "X-Retry-After": "42" } },
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("x-retry-after")).toBe("42");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      message: "Too many requests. Please try again later.",
      code: "RATE_LIMITED",
    });
  });

  it("uses a plain text body as the message", async () => {
    const response = await withJsonRateLimit(
      new Response("Slow down", { status: 429 }),
    );

    expect(await response.json()).toEqual({
      message: "Slow down",
      code: "RATE_LIMITED",
    });
  });

  it("falls back to a default message for an empty 429", async () => {
    const response = await withJsonRateLimit(
      new Response(null, { status: 429 }),
    );

    expect(await response.json()).toEqual({
      message: "Too many requests",
      code: "RATE_LIMITED",
    });
  });

  it("keeps a 429 that already has the standard shape", async () => {
    const original = Response.json(
      { message: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 },
    );

    expect(await withJsonRateLimit(original)).toBe(original);
  });

  it("keeps other responses", async () => {
    const original = new Response(null, { status: 204 });

    expect(await withJsonRateLimit(original)).toBe(original);
  });
});
