import { HTTPException } from "hono/http-exception";
import { type ApiKeyDenial, apiKeyDenialHeaders } from "./rate-limit-headers";

export function apiKeyRejection(denial: ApiKeyDenial | null, now = new Date()) {
  if (!denial) return new HTTPException(401, { message: "Unauthorized" });
  const message =
    denial.status === "rate_limited"
      ? "Rate limit exceeded"
      : "API key usage limit exceeded";
  return new HTTPException(429, {
    message,
    res: new Response(message, {
      status: 429,
      headers: apiKeyDenialHeaders(denial, now),
    }),
  });
}
