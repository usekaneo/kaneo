import { describe, expect, it } from "vite-plus/test";
import {
  apiKeyDenialHeaders,
  apiKeyResponseHeaders,
  rateLimitHeaders,
  retryAfterFromBody,
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

describe("retryAfterFromBody", () => {
  it("turns Better Auth's tryAgainIn milliseconds into seconds", () => {
    expect(retryAfterFromBody({ details: { tryAgainIn: 4_500 } }, now)).toBe(
      "5",
    );
  });

  it("returns null without a numeric wait", () => {
    for (const body of [
      null,
      "slow down",
      {},
      { details: { tryAgainIn: "5" } },
    ])
      expect(retryAfterFromBody(body, now)).toBeNull();
  });
});

describe("apiKeyResponseHeaders", () => {
  const window = { limit: 5, remaining: 2, resetAt: at(30_000) };
  const valid = { status: "valid" as const, rateLimit: window };
  const ok = new Response("ok");
  const tooMany = new Response("slow down", { status: 429 });
  const ipLimited = (retryAfter = "42") =>
    new Response(
      JSON.stringify({ message: "Too many requests. Please try again later." }),
      { status: 429, headers: { "X-Retry-After": retryAfter } },
    );

  it("reports the window after a successful request", async () => {
    expect(await apiKeyResponseHeaders(valid, ok, now)).toEqual(
      rateLimitHeaders(window),
    );
  });

  it("still reports the window when the request spent the last quota unit", async () => {
    expect(
      await apiKeyResponseHeaders(
        { status: "usage_exceeded", retryAt: null, rateLimit: window },
        ok,
        now,
      ),
    ).toEqual(rateLimitHeaders(window));
  });

  it("reports an empty window when the request filled it", async () => {
    expect(
      await apiKeyResponseHeaders(
        { status: "rate_limited", limit: 5, resetAt: at(30_000) },
        ok,
        now,
      ),
    ).toEqual(rateLimitHeaders({ ...window, remaining: 0 }));
  });

  it("adds the retry headers to a 429 that lacks Retry-After", async () => {
    const denial = {
      status: "rate_limited" as const,
      limit: 5,
      resetAt: at(30_000),
    };
    expect(await apiKeyResponseHeaders(denial, tooMany, now)).toEqual(
      apiKeyDenialHeaders(denial, now),
    );
  });

  it("leaves Retry-After alone when the 429 already has one", async () => {
    const answered = new Response(null, {
      status: 429,
      headers: { "Retry-After": "7" },
    });
    expect(
      await apiKeyResponseHeaders(
        { status: "rate_limited", limit: 5, resetAt: at(30_000) },
        answered,
        now,
      ),
    ).not.toHaveProperty("Retry-After");
  });

  it("copies Better Auth's X-Retry-After without the key's window on an IP limit", async () => {
    expect(await apiKeyResponseHeaders(valid, ipLimited(), now)).toEqual({
      "Retry-After": "42",
    });
    expect(await apiKeyResponseHeaders(valid, ipLimited("0"), now)).toEqual({
      "Retry-After": "1",
    });
  });

  it("treats an IP limit as Better Auth's even when the key is also exhausted", async () => {
    expect(
      await apiKeyResponseHeaders(
        { status: "rate_limited", limit: 5, resetAt: at(30_000) },
        ipLimited(),
        now,
      ),
    ).toEqual({ "Retry-After": "42" });
  });

  it("computes Retry-After from the body of a 429 the key did not cause", async () => {
    const limited = new Response(
      JSON.stringify({ code: "RATE_LIMITED", details: { tryAgainIn: 2_500 } }),
      { status: 429 },
    );
    expect(await apiKeyResponseHeaders(valid, limited, now)).toEqual({
      "Retry-After": "3",
    });
    expect(await limited.json()).toMatchObject({ code: "RATE_LIMITED" });
  });

  it("adds nothing to a 429 the key did not cause without a known wait", async () => {
    expect(await apiKeyResponseHeaders(valid, tooMany.clone(), now)).toEqual(
      {},
    );
    const answered = new Response(null, {
      status: 429,
      headers: { "Retry-After": "7", "X-Retry-After": "7" },
    });
    expect(await apiKeyResponseHeaders(valid, answered, now)).toEqual({});
  });

  it("sends nothing when the key could not be read", async () => {
    expect(await apiKeyResponseHeaders(null, ipLimited(), now)).toEqual({});
  });
});
