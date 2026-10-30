import type { Context, Next } from "hono";
import { ApiError } from "../../errors/api-error";
import { getUserAccess, holdsAll } from "./get-instance-access";

/**
 * Only built-in admins may act on users who hold permissions they lack, so a
 * custom role can't take over, lock out, or demote a more powerful account.
 */
export async function assertCanManageUser(actorId: string, targetId: string) {
  const actor = await getUserAccess(actorId);
  if (actor.isAdmin) return;
  const target = await getUserAccess(targetId);
  if (!holdsAll(actor, target.permissions)) {
    throw new ApiError(403, {
      code: "USER_HAS_MORE_PERMISSIONS",
      message: "You can't manage a user who has permissions you don't have.",
    });
  }
}

/** For routes with a `{userId}` path parameter; an unknown user is left to the route. */
export async function requireManageableUser(c: Context, next: Next) {
  const targetId = c.req.param("userId");
  if (targetId) await assertCanManageUser(c.get("user").id, targetId);
  return next();
}
