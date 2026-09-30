import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

/** Sensitive account operations cannot inherit the owner's privileges from an API key. */
export async function requireUserSession(c: Context, next: Next) {
  if (c.get("apiKey") || !c.get("session") || !c.get("user")) {
    throw new HTTPException(403, { message: "A user session is required" });
  }
  c.header("Cache-Control", "no-store");
  return next();
}
