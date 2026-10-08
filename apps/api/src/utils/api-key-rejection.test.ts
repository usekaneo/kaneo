import { describe, expect, it } from "vite-plus/test";
import { betterAuthLimitRejection } from "./api-key-rejection";

const now = new Date("2026-01-01T00:00:00.000Z");
const rateLimitedBody = {
  code: "RATE_LIMITED",
  details: { tryAgainIn: 4_500 },
};

function headersOf(error: ReturnType<typeof betterAuthLimitRejection>) {
  return Object.fromEntries(error.getResponse().headers);
}

describe("betterAuthLimitRejection", () => {
  it("answers with the key's own retry headers when the key is denied", () => {
    const resetAt = new Date(now.getTime() + 30_000);
    const error = betterAuthLimitRejection(
      rateLimitedBody,
      { status: "rate_limited", limit: 10, resetAt },
      now,
    );

    expect(error.status).toBe(429);
    expect(headersOf(error)).toMatchObject({
      "retry-after": "30",
      "x-ratelimit-limit": "10",
      "x-ratelimit-remaining": "0",
      "x-ratelimit-reset": String(Math.ceil(resetAt.getTime() / 1000)),
    });
  });

  it("uses the refill time for an exhausted quota", async () => {
    const error = betterAuthLimitRejection(
      { code: "USAGE_EXCEEDED" },
      {
        status: "usage_exceeded",
        retryAt: new Date(now.getTime() + 120_000),
        rateLimit: null,
      },
      now,
    );

    expect(headersOf(error)).toMatchObject({ "retry-after": "120" });
    expect(await error.getResponse().text()).toBe(
      "API key usage limit exceeded",
    );
  });

  it("falls back to Better Auth's wait when the key cannot be checked", () => {
    for (const check of [null, { status: "valid" as const, rateLimit: null }]) {
      const error = betterAuthLimitRejection(rateLimitedBody, check, now);
      expect(error.status).toBe(429);
      expect(headersOf(error)).toEqual({
        "content-type": "text/plain;charset=UTF-8",
        "retry-after": "5",
      });
    }
  });
});
