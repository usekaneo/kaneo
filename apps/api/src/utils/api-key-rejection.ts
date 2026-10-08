import { HTTPException } from "hono/http-exception";
import {
  type ApiKeyCheck,
  type ApiKeyDenial,
  apiKeyDenialHeaders,
  retryAfterFromBody,
} from "./rate-limit-headers";

function tooManyRequests(message: string, headers: Record<string, string>) {
  return new HTTPException(429, {
    message,
    res: new Response(message, { status: 429, headers }),
  });
}

export function apiKeyRejection(denial: ApiKeyDenial | null, now = new Date()) {
  if (!denial) return new HTTPException(401, { message: "Unauthorized" });
  return tooManyRequests(
    denial.status === "rate_limited"
      ? "Rate limit exceeded"
      : "API key usage limit exceeded",
    apiKeyDenialHeaders(denial, now),
  );
}

export function betterAuthLimitRejection(
  body: unknown,
  check: ApiKeyCheck | null,
  now = new Date(),
) {
  if (check && check.status !== "valid") return apiKeyRejection(check, now);
  const { code } = (body ?? {}) as { code?: unknown };
  if (code === "USAGE_EXCEEDED")
    return apiKeyRejection(
      { status: "usage_exceeded", retryAt: null, rateLimit: null },
      now,
    );
  const retryAfter = retryAfterFromBody(body, now);
  return tooManyRequests(
    "Rate limit exceeded",
    retryAfter ? { "Retry-After": retryAfter } : {},
  );
}
