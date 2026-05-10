import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { auth } from "../auth";
import { isInstanceAdmin } from "./is-instance-admin";

type PermissionMap = Record<string, string[]>;

export function requireWorkspacePermission(permissions: PermissionMap) {
  return async (c: Context, next: Next) => {
    const workspaceId = c.get("workspaceId");
    if (!workspaceId) {
      throw new HTTPException(500, {
        message: "workspaceId not set in context",
      });
    }

    if (await isInstanceAdmin(c)) {
      return next();
    }

    let allowed = false;
    try {
      const result = await auth.api.hasPermission({
        headers: c.req.raw.headers,
        body: {
          organizationId: workspaceId,
          permissions,
        },
      });
      allowed = result?.success === true;
    } catch {
      allowed = false;
    }

    if (!allowed) {
      throw new HTTPException(403, { message: "Insufficient permissions" });
    }

    return next();
  };
}
