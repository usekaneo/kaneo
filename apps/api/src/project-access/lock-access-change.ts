import { and, eq, inArray } from "drizzle-orm";
import { schema } from "../database";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import type { DbOrTx } from "./db-or-tx";

export async function lockAccessChange(
  database: DbOrTx,
  change: { workspaceId: string; actorId: string; userId: string },
): Promise<{ actorAllowed: boolean; targetIsMember: boolean }> {
  const rows = await database
    .select({ userId: schema.workspaceUserTable.userId })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, change.workspaceId),
        inArray(schema.workspaceUserTable.userId, [
          change.actorId,
          change.userId,
        ]),
      ),
    )
    .orderBy(schema.workspaceUserTable.id)
    .for("update");
  const members = new Set(rows.map((row) => row.userId));

  let actorAllowed = members.has(change.actorId);
  if (!actorAllowed) {
    const [actor] = await database
      .select({ role: schema.userTable.role })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, change.actorId))
      .limit(1);
    actorAllowed = hasInstanceAdminRole(actor?.role);
  }

  return { actorAllowed, targetIsMember: members.has(change.userId) };
}
