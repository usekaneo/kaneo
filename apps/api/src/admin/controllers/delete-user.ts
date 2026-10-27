import { isAPIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import deleteAccountData from "../../user/controllers/delete-account-data";
import { revokeUserConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockAdminTargetUser } from "../users/lock-admin-target-user";
import { rejectSelfAction } from "../users/reject-self-action";

/** The same cleanup as self-service account deletion, with its conflicts. */
async function removeAccountData(userId: string) {
  try {
    await deleteAccountData(userId);
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
  await lockAdminTargetUser(userId, db);
  await removeAccountData(userId);

  await db.transaction(async (tx) => {
    const target = await lockAdminTargetUser(userId, tx);
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
