import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import type { DbOrTx } from "./db-or-tx";
import { getMemberProjectAccess } from "./get-member-project-access";
import { isOwnerRole } from "./is-owner-role";

export async function isProjectAccessRestricted(
  workspaceId: string,
  userId: string,
  database: DbOrTx = db,
): Promise<boolean> {
  const access = await getMemberProjectAccess(workspaceId, userId, database);
  if (access.projectAccess === "all") return false;

  const [row] = await database
    .select({
      memberRole: schema.workspaceUserTable.role,
      userRole: schema.userTable.role,
    })
    .from(schema.userTable)
    .leftJoin(
      schema.workspaceUserTable,
      and(
        eq(schema.workspaceUserTable.userId, schema.userTable.id),
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .where(eq(schema.userTable.id, userId))
    .limit(1);

  return !isOwnerRole(row?.memberRole) && !hasInstanceAdminRole(row?.userRole);
}
