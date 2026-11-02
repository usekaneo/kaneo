import { getConnInfo } from "@hono/node-server/conninfo";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

const claimWindows = new Map<string, { until: number; count: number }>();
const callbackWindows = new Map<string, { until: number; count: number }>();
// Per-process abuse bound, independent of optional Redis. Do not trust forwarded
// IP headers: operators can enforce stricter global limits at their proxy.
export const callbackRateLimit: MiddlewareHandler = async (c, next) => {
  let address = "unknown";
  try {
    address = getConnInfo(c).remote.address ?? address;
  } catch {
    /* In-process API tests have no socket. */
  }
  const claim = c.req.path.endsWith("/claim");
  // Anonymous claims cannot occupy the authenticated callback quota.
  const windows = claim ? claimWindows : callbackWindows;
  const key = claim
    ? `claim:${address}`
    : `callback:${c.req.param("jobId") ?? address}`;
  const now = Date.now();
  for (const [key, value] of windows)
    if (value.until <= now) windows.delete(key);
  const value = windows.get(key) ?? { until: now + 60000, count: 0 };
  if ((!windows.has(key) && windows.size >= 4096) || ++value.count > 120)
    throw new HTTPException(429, {
      message: "Job callback rate limit reached",
    });
  windows.set(key, value);
  return next();
};
