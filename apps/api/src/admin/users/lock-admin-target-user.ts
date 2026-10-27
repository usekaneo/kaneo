import { eq } from "drizzle-orm";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** The user an admin action changes, locked until the transaction ends. */
export async function lockAdminTargetUser(userId: string, tx: DbOrTx) {
  const [user] = await tx
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      emailVerified: userTable.emailVerified,
      role: userTable.role,
      banned: userTable.banned,
      banExpires: userTable.banExpires,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1)
    .for("update");
  if (!user) {
    throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
  }
  return user;
}
