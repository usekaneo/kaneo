import { describe, expect, it } from "vite-plus/test";
import { httpExceptionResponse } from "../errors/http-exception-response";
import { apiKeyRejection } from "./api-key-rejection";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("apiKeyRejection", () => {
  it("answers 401 for an unknown key", async () => {
    const response = await httpExceptionResponse(apiKeyRejection(null, now));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: "Unauthorized",
      code: "UNAUTHORIZED",
    });
  });

  it("answers a rate limited key with JSON and the key's retry headers", async () => {
    const resetAt = new Date(now.getTime() + 30_000);
    const response = await httpExceptionResponse(
      apiKeyRejection({ status: "rate_limited", limit: 10, resetAt }, now),
    );

    expect(response.status).toBe(429);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": expect.stringContaining("application/json"),
      "retry-after": "30",
      "x-ratelimit-limit": "10",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.ceil(resetAt.getTime() / 1000)),
    });
    expect(await response.json()).toEqual({
      message: "Rate limit exceeded",
      code: "RATE_LIMITED",
    });
  });

  it("uses the refill time for an exhausted quota", async () => {
    const response = await httpExceptionResponse(
      apiKeyRejection(
        {
          status: "usage_exceeded",
          retryAt: new Date(now.getTime() + 120_000),
          rateLimit: null,
        },
        now,
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("x-ratelimit-limit")).toBeNull();
    expect(await response.json()).toEqual({
      message: "API key usage limit exceeded",
      code: "RATE_LIMITED",
    });
  });
});
