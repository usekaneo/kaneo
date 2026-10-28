import { and, eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../users/find-admin-target-user";

/** Mark a user's email verified. Already verified addresses are left alone. */
async function markEmailVerified(userId: string, audit: AdminAuditRequest) {
  await db.transaction(async (tx) => {
    const user = await findAdminTargetUser(userId, tx);
    if (user.isAnonymous) {
      throw new ApiError(409, {
        code: "GUEST_ACCOUNT",
        message: "Guest accounts have no email address to verify.",
      });
    }
    const [updated] = await tx
      .update(userTable)
      .set({ emailVerified: true })
      .where(and(eq(userTable.id, userId), eq(userTable.emailVerified, false)))
      .returning({ email: userTable.email });
    if (!updated) return;

    await recordAdminAction(
      {
        ...audit,
        action: "user.email_verified",
        targetType: "user",
        targetId: userId,
        targetLabel: updated.email,
      },
      tx,
    );
  });
  return { emailVerified: true as const };
}

export default markEmailVerified;
