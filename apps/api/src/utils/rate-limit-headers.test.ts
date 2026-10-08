import { describe, expect, it } from "vite-plus/test";
import {
  apiKeyDenialHeaders,
  apiKeyResponseHeaders,
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
        { status: "usage_exceeded", retryAt: at(3_600_000), rateLimit: null },
        now,
      ),
    ).toEqual({ "Retry-After": "3600" });
    expect(
      apiKeyDenialHeaders(
        { status: "usage_exceeded", retryAt: null, rateLimit: null },
        now,
      ),
    ).toEqual({});
  });
});

describe("apiKeyResponseHeaders", () => {
  const window = { limit: 5, remaining: 2, resetAt: at(30_000) };
  const ok = new Response("ok");
  const tooMany = new Response("slow down", { status: 429 });

  it("reports the window after a successful request", () => {
    expect(
      apiKeyResponseHeaders({ status: "valid", rateLimit: window }, ok, now),
    ).toEqual(rateLimitHeaders(window));
  });

  it("still reports the window when the request spent the last quota unit", () => {
    expect(
      apiKeyResponseHeaders(
        { status: "usage_exceeded", retryAt: null, rateLimit: window },
        ok,
        now,
      ),
    ).toEqual(rateLimitHeaders(window));
  });

  it("reports an empty window when the request filled it", () => {
    expect(
      apiKeyResponseHeaders(
        { status: "rate_limited", limit: 5, resetAt: at(30_000) },
        ok,
        now,
      ),
    ).toEqual(rateLimitHeaders({ ...window, remaining: 0 }));
  });

  it("adds the retry headers to a 429 that lacks Retry-After", () => {
    const denial = {
      status: "rate_limited" as const,
      limit: 5,
      resetAt: at(30_000),
    };
    expect(apiKeyResponseHeaders(denial, tooMany, now)).toEqual(
      apiKeyDenialHeaders(denial, now),
    );
  });

  it("leaves Retry-After alone when the 429 already has one", () => {
    const answered = new Response(null, {
      status: 429,
      headers: { "Retry-After": "7" },
    });
    expect(
      apiKeyResponseHeaders(
        { status: "rate_limited", limit: 5, resetAt: at(30_000) },
        answered,
        now,
      ),
    ).not.toHaveProperty("Retry-After");
  });

  it("sends nothing when the key could not be read", () => {
    expect(apiKeyResponseHeaders(null, tooMany, now)).toEqual({});
  });
});
