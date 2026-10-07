import { describe, expect, it } from "vite-plus/test";
import {
  apiKeyDenialHeaders,
  rateLimitHeaders,
  retryAfterSeconds,
} from "./rate-limit-headers";

const now = new Date("2026-01-01T00:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);

describe("retryAfterSeconds", () => {
  it("rounds partial seconds up", () => {
    expect(retryAfterSeconds(at(1_200), now)).toBe("2");
    expect(retryAfterSeconds(at(59_001), now)).toBe("60");
  });

  it("never asks for less than one second", () => {
    expect(retryAfterSeconds(at(0), now)).toBe("1");
    expect(retryAfterSeconds(at(-5_000), now)).toBe("1");
  });
});

describe("rateLimitHeaders", () => {
  it("reports the limit, remaining requests and the reset time in epoch seconds", () => {
    expect(
      rateLimitHeaders({ limit: 100, remaining: 42, resetAt: at(30_500) }),
    ).toEqual({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "42",
      "X-RateLimit-Reset": String(Math.ceil(at(30_500).getTime() / 1000)),
    });
  });

  it("does not report a negative remaining count", () => {
    expect(
      rateLimitHeaders({ limit: 2, remaining: -1, resetAt: at(1_000) })[
        "X-RateLimit-Remaining"
      ],
    ).toBe("0");
  });
});

describe("apiKeyDenialHeaders", () => {
  it("sends Retry-After and an empty window when rate limited", () => {
    expect(
      apiKeyDenialHeaders(
        { status: "rate_limited", limit: 100, resetAt: at(12_300) },
        now,
      ),
    ).toEqual({
      "Retry-After": "13",
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(at(12_300).getTime() / 1000)),
    });
  });

  it("sends Retry-After for an exhausted quota only when it refills", () => {
    expect(
      apiKeyDenialHeaders(
        { status: "usage_exceeded", retryAt: at(3_600_000) },
        now,
      ),
    ).toEqual({ "Retry-After": "3600" });
    expect(
      apiKeyDenialHeaders({ status: "usage_exceeded", retryAt: null }, now),
    ).toEqual({});
  });
});
