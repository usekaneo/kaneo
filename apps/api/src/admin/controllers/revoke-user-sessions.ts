import db from "../../database";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import { revokeSessionConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../find-admin-target-user";

/** Sign a user out everywhere. An admin's own current session is kept. */
async function revokeUserSessions(
  userId: string,
  adminSessionId: string | null,
  audit: AdminAuditRequest,
) {
  const revoked = await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(tx, userId);
    const ids = await deleteUserSessions(tx, userId, {
      exceptSessionId: adminSessionId,
    });
    if (ids.length > 0) {
      await recordAdminAction(
        {
          ...audit,
          action: "session.revoked_all",
          targetType: "user",
          targetId: user.id,
          targetLabel: user.email,
          metadata: { count: ids.length },
        },
        tx,
      );
    }
    return ids;
  });
  await revokeSessionConnections(userId, revoked);
  return { revoked: revoked.length };
}

export default revokeUserSessions;
