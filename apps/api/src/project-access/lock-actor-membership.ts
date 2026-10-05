import { and, eq } from "drizzle-orm";
import { schema } from "../database";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import type { DbOrTx } from "./db-or-tx";

export async function lockActorMembership(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const [user] = await database
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId))
    .limit(1);
  if (hasInstanceAdminRole(user?.role)) return true;

  const [member] = await database
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1)
    .for("share");

  return Boolean(member);
}
