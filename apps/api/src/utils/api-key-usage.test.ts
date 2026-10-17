import { describe, expect, it } from "vite-plus/test";
import { type ApiKeyUsageRow, evaluateApiKeyUsage } from "./api-key-usage";

const now = new Date("2026-01-01T00:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);

function row(overrides: Partial<ApiKeyUsageRow> = {}): ApiKeyUsageRow {
  return {
    createdAt: at(-86_400_000),
    lastRefillAt: null,
    lastRequest: at(-10_000),
    rateLimitEnabled: true,
    rateLimitMax: 5,
    rateLimitTimeWindow: 60_000,
    refillAmount: null,
    refillInterval: null,
    remaining: null,
    requestCount: 2,
    ...overrides,
  };
}

describe("evaluateApiKeyUsage", () => {
  it("reads the window without spending a request", () => {
    expect(evaluateApiKeyUsage(row(), now, false)).toEqual({
      status: "valid",
      remaining: null,
      lastRefillAt: null,
      requestCount: 2,
      rateLimit: { limit: 5, remaining: 3, resetAt: at(50_000) },
    });
  });

  it("spends one request and restarts the window when consuming", () => {
    expect(evaluateApiKeyUsage(row({ remaining: 4 }), now, true)).toEqual({
      status: "valid",
      remaining: 3,
      lastRefillAt: null,
      requestCount: 3,
      rateLimit: { limit: 5, remaining: 2, resetAt: at(60_000) },
    });
  });

  it("starts a fresh window after a full idle window", () => {
    expect(
      evaluateApiKeyUsage(
        row({ lastRequest: at(-60_000), requestCount: 5 }),
        now,
        false,
      ),
    ).toMatchObject({
      status: "valid",
      requestCount: 0,
      rateLimit: { limit: 5, remaining: 5, resetAt: at(60_000) },
    });
  });

  it("denies a full window", () => {
    expect(evaluateApiKeyUsage(row({ requestCount: 5 }), now, true)).toEqual({
      status: "rate_limited",
      limit: 5,
      resetAt: at(50_000),
    });
  });

  it("keeps the window on an exhausted quota", () => {
    expect(evaluateApiKeyUsage(row({ remaining: 0 }), now, false)).toEqual({
      status: "usage_exceeded",
      retryAt: null,
      rateLimit: { limit: 5, remaining: 3, resetAt: at(50_000) },
    });
  });

  it("reports when an exhausted quota refills", () => {
    expect(
      evaluateApiKeyUsage(
        row({
          remaining: 0,
          refillAmount: 10,
          refillInterval: 3_600_000,
          lastRefillAt: at(-600_000),
          rateLimitEnabled: false,
        }),
        now,
        true,
      ),
    ).toEqual({
      status: "usage_exceeded",
      retryAt: at(3_000_000),
      rateLimit: null,
    });
  });

  it("refills a due quota before spending from it", () => {
    expect(
      evaluateApiKeyUsage(
        row({
          remaining: 0,
          refillAmount: 10,
          refillInterval: 3_600_000,
          lastRefillAt: at(-3_600_000),
        }),
        now,
        true,
      ),
    ).toMatchObject({ status: "valid", remaining: 9, lastRefillAt: now });
  });

  it("leaves the stored count alone when rate limiting is off", () => {
    expect(
      evaluateApiKeyUsage(
        row({ rateLimitEnabled: false, requestCount: 7 }),
        now,
        true,
      ),
    ).toEqual({
      status: "valid",
      remaining: null,
      lastRefillAt: null,
      requestCount: 7,
      rateLimit: null,
    });
  });
});
