export type ApiKeyRateLimit = {
  limit: number;
  remaining: number;
  resetAt: Date;
};

export type ApiKeyDenial =
  | { status: "rate_limited"; limit: number; resetAt: Date }
  | {
      status: "usage_exceeded";
      retryAt: Date | null;
      rateLimit: ApiKeyRateLimit | null;
    };

export type ApiKeyCheck =
  | ApiKeyDenial
  | { status: "valid"; rateLimit: ApiKeyRateLimit | null };

export function retryAfterSeconds(retryAt: Date, now: Date) {
  return String(
    Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000)),
  );
}

export function rateLimitHeaders({
  limit,
  remaining,
  resetAt,
}: ApiKeyRateLimit): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt.getTime() / 1000)),
  };
}

export function apiKeyDenialHeaders(
  denial: ApiKeyDenial,
  now: Date,
): Record<string, string> {
  if (denial.status === "rate_limited") {
    return {
      "Retry-After": retryAfterSeconds(denial.resetAt, now),
      ...rateLimitHeaders({
        limit: denial.limit,
        remaining: 0,
        resetAt: denial.resetAt,
      }),
    };
  }
  return denial.retryAt
    ? { "Retry-After": retryAfterSeconds(denial.retryAt, now) }
    : {};
}

export function apiKeyResponseHeaders(
  check: ApiKeyCheck | null,
  response: Response,
  now: Date,
): Record<string, string> {
  if (!check) return {};
  if (
    check.status !== "valid" &&
    response.status === 429 &&
    !response.headers.has("Retry-After")
  )
    return apiKeyDenialHeaders(check, now);
  if (check.status === "rate_limited")
    return rateLimitHeaders({
      limit: check.limit,
      remaining: 0,
      resetAt: check.resetAt,
    });
  return check.rateLimit ? rateLimitHeaders(check.rateLimit) : {};
}
