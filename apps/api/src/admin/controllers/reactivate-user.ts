import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockAdminTargetUser } from "../users/lock-admin-target-user";
import { readAdminUser } from "../users/read-admin-user";
import { rejectSelfAction } from "../users/reject-self-action";

/** Let a deactivated user sign in again. */
async function reactivateUser(
  userId: string,
  actorId: string,
  audit: AdminAuditRequest,
) {
  rejectSelfAction(
    actorId,
    userId,
    "YOU_CANNOT_UNBAN_YOURSELF",
    "You cannot reactivate yourself.",
  );
  return db.transaction(async (tx) => {
    const target = await lockAdminTargetUser(userId, tx);
    if (target.banned) {
      await tx
        .update(userTable)
        .set({ banned: false, banReason: null, banExpires: null })
        .where(eq(userTable.id, userId));
      await recordAdminAction(
        {
          ...audit,
          action: "user.reactivated",
          targetType: "user",
          targetId: userId,
          targetLabel: target.email,
        },
        tx,
      );
    }
    return readAdminUser(userId, tx);
  });
}

export default reactivateUser;
