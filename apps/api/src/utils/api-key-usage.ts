import type { apikeyTable } from "../database/schema";
import type { ApiKeyDenial, ApiKeyRateLimit } from "./rate-limit-headers";

export type ApiKeyUsageRow = Pick<
  typeof apikeyTable.$inferSelect,
  | "createdAt"
  | "lastRefillAt"
  | "lastRequest"
  | "rateLimitEnabled"
  | "rateLimitMax"
  | "rateLimitTimeWindow"
  | "refillAmount"
  | "refillInterval"
  | "remaining"
  | "requestCount"
>;

export type ApiKeyAllowance = {
  status: "valid";
  remaining: number | null;
  lastRefillAt: Date | null;
  requestCount: number;
  rateLimit: ApiKeyRateLimit | null;
};

type RateWindow = {
  limit: number;
  length: number;
  count: number;
  anchor: Date;
};

function currentWindow(apiKey: ApiKeyUsageRow, now: Date): RateWindow {
  const limit = apiKey.rateLimitMax ?? 100;
  const length = apiKey.rateLimitTimeWindow ?? 60_000;
  const anchor = apiKey.lastRequest;
  if (!anchor || now.getTime() - anchor.getTime() >= length)
    return { limit, length, count: 0, anchor: now };
  return { limit, length, count: apiKey.requestCount ?? 0, anchor };
}

function windowRateLimit(window: RateWindow): ApiKeyRateLimit {
  return {
    limit: window.limit,
    remaining: window.limit - window.count,
    resetAt: new Date(window.anchor.getTime() + window.length),
  };
}

export function evaluateApiKeyUsage(
  apiKey: ApiKeyUsageRow,
  now: Date,
  consume: boolean,
): ApiKeyDenial | ApiKeyAllowance {
  let remaining = apiKey.remaining;
  let lastRefillAt = apiKey.lastRefillAt;
  if (
    remaining !== null &&
    apiKey.refillInterval &&
    apiKey.refillAmount &&
    now.getTime() - (lastRefillAt ?? apiKey.createdAt).getTime() >=
      apiKey.refillInterval
  ) {
    remaining = apiKey.refillAmount;
    lastRefillAt = now;
  }

  const window = apiKey.rateLimitEnabled ? currentWindow(apiKey, now) : null;

  if (remaining !== null && remaining <= 0)
    return {
      status: "usage_exceeded",
      retryAt:
        apiKey.refillInterval && apiKey.refillAmount
          ? new Date(
              (lastRefillAt ?? apiKey.createdAt).getTime() +
                apiKey.refillInterval,
            )
          : null,
      rateLimit: window && windowRateLimit(window),
    };

  if (window && window.count >= window.limit)
    return {
      status: "rate_limited",
      limit: window.limit,
      resetAt: windowRateLimit(window).resetAt,
    };

  const used =
    window && consume
      ? { ...window, count: window.count + 1, anchor: now }
      : window;
  return {
    status: "valid",
    remaining: consume && remaining !== null ? remaining - 1 : remaining,
    lastRefillAt,
    requestCount: used ? used.count : (apiKey.requestCount ?? 0),
    rateLimit: used && windowRateLimit(used),
  };
}
