import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

import { boundedRequestBody } from "../utils/bounded-request-body";

export const OAUTH_BODY_BYTES = 32 * 1024;
export const OAUTH_URL_BYTES = 8 * 1024;
const checkBody = boundedRequestBody(OAUTH_BODY_BYTES);

const checkRequestBounds: MiddlewareHandler = async (c, next) => {
  if (Buffer.byteLength(c.req.url) > OAUTH_URL_BYTES) {
    throw new HTTPException(414, { message: "OAuth URL is too long" });
  }
  return checkBody(c, next);
};

export const OAUTH_MAX_IN_FLIGHT = 16;
const activeRequests = { registration: 0, authorization: 0, token: 0 };

export const oauthRequestBounds: MiddlewareHandler = async (c, next) => {
  const group = c.req.path.endsWith("/register")
    ? "registration"
    : c.req.path.endsWith("/token")
      ? "token"
      : "authorization";
  if (activeRequests[group] >= OAUTH_MAX_IN_FLIGHT) {
    void c.req.raw.body?.cancel().catch(() => {});
    return c.json({ error: "temporarily_unavailable" }, 429, {
      "Retry-After": "1",
      "Cache-Control": "no-store",
    });
  }
  activeRequests[group]++;
  try {
    return await checkRequestBounds(c, next);
  } finally {
    activeRequests[group]--;
  }
};
