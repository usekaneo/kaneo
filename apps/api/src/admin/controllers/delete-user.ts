import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import deleteAccountData from "../../user/controllers/delete-account-data";
import { hasOtherInstanceAdmin } from "../../utils/has-other-instance-admin";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import { revokeUserConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { rejectSelfAction } from "../users/reject-self-action";

/** The same cleanup as self-service account deletion, with its conflicts. */
async function removeAccountData(userId: string, tx: DbOrTx) {
  try {
    await deleteAccountData(userId, tx);
  } catch (error) {
    if (!isAPIError(error)) throw error;
    throw new ApiError(error.statusCode as ContentfulStatusCode, {
      code: String(error.body?.code ?? "ACCOUNT_DELETION_BLOCKED"),
      message: error.message,
    });
  }
}

/** Delete a user's account, workspaces they solely own, and their sessions. */
async function deleteUser(
  userId: string,
  actorId: string,
  audit: AdminAuditRequest,
) {
  rejectSelfAction(
    actorId,
    userId,
    "YOU_CANNOT_REMOVE_YOURSELF",
    "You cannot remove yourself.",
  );
  await db.transaction(async (tx) => {
    // The advisory lock serializes role removals before account cleanup.
    const otherAdminRemains = await hasOtherInstanceAdmin(tx);
    const [target] = await tx
      .select({
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!target) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
    }
    if (hasInstanceAdminRole(target.role) && !otherAdminRemains) {
      throw new ApiError(400, {
        code: "CANNOT_REMOVE_LAST_ADMIN",
        message: "The instance must have at least one administrator.",
      });
    }
    await removeAccountData(userId, tx);
    // Lock the user only after workspaces: their deletion audit locks its actor.
    await deleteUserSessions(tx, userId, { exceptSessionId: null });
    await tx.delete(userTable).where(eq(userTable.id, userId));
    await recordAdminAction(
      {
        ...audit,
        action: "user.deleted",
        targetType: "user",
        targetId: userId,
        targetLabel: target.email,
        metadata: { name: target.name },
      },
      tx,
    );
  });
  await revokeUserConnections(userId);
  return { id: userId };
}

export default deleteUser;
