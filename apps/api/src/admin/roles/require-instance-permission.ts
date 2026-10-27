import type { InstancePermission } from "@kaneo/permissions";
import type { Context, Next } from "hono";
import { ApiError } from "../../errors/api-error";
import { getUserAccess } from "./get-instance-access";

/** Admin routes run after `requireUserSession`, so the caller is a user. */
export function requireInstancePermission(permission: InstancePermission) {
  return async function requirePermission(c: Context, next: Next) {
    const access = await getUserAccess(c.get("user").id);
    if (!access.permissions.includes(permission)) {
      throw new ApiError(403, {
        code: "INSTANCE_PERMISSION_REQUIRED",
        message: "You don't have permission to do this.",
        missingPermissions: [permission],
      });
    }
    return next();
  };
}
