import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { isInstanceAdmin } from "./is-instance-admin";

export async function requireInstanceAdmin(c: Context, next: Next) {
  if (!(await isInstanceAdmin(c))) {
    throw new HTTPException(403, {
      message: "Instance administrator access is required",
    });
  }
  return next();
}
