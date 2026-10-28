import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { deleteUserSessions } from "../../sessions/delete-user-sessions";
import { isBanActive } from "../../utils/user-ban";
import { revokeSessionConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockAdminTargetUser } from "../users/lock-admin-target-user";
import { readAdminUser } from "../users/read-admin-user";
import { rejectSelfAction } from "../users/reject-self-action";

const BAN_REASON = "Deactivated by an instance administrator";

/** Block sign-in until reactivated and end every session the user has. */
async function deactivateUser(
  userId: string,
  actorId: string,
  audit: AdminAuditRequest,
) {
  rejectSelfAction(
    actorId,
    userId,
    "YOU_CANNOT_BAN_YOURSELF",
    "You cannot deactivate yourself.",
  );
  const { user, sessionIds } = await db.transaction(async (tx) => {
    const target = await lockAdminTargetUser(userId, tx);
    await tx
      .update(userTable)
      .set({ banned: true, banReason: BAN_REASON, banExpires: null })
      .where(eq(userTable.id, userId));
    const sessionIds = await deleteUserSessions(tx, userId, {
      exceptSessionId: null,
    });
    if (!isBanActive(target) || target.banExpires) {
      await recordAdminAction(
        {
          ...audit,
          action: "user.deactivated",
          targetType: "user",
          targetId: userId,
          targetLabel: target.email,
          metadata: { reason: BAN_REASON, expiresAt: null },
        },
        tx,
      );
    }
    return { user: await readAdminUser(userId, tx), sessionIds };
  });
  await revokeSessionConnections(userId, sessionIds);
  return user;
}

export default deactivateUser;
