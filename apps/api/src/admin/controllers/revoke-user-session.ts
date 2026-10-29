import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import { revokeSessionConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../find-admin-target-user";

async function revokeUserSession(
  { userId, sessionId }: { userId: string; sessionId: string },
  adminSessionId: string | null,
  audit: AdminAuditRequest,
) {
  if (sessionId === adminSessionId) {
    throw new HTTPException(409, {
      message: "Sign out to end your current session",
    });
  }
  const revoked = await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(tx, userId);
    const ids = await deleteUserSessions(tx, userId, { sessionId });
    if (ids.length === 0) {
      throw new HTTPException(404, { message: "Session not found" });
    }
    await recordAdminAction(
      {
        ...audit,
        action: "session.revoked",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { sessionId },
      },
      tx,
    );
    return ids;
  });
  await revokeSessionConnections(userId, revoked);
  return { revoked: revoked.length };
}

export default revokeUserSession;
