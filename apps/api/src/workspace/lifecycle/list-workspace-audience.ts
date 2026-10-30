import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { instanceAdminRoleSql } from "../../utils/instance-admin-role";

/**
 * Everyone who may hold a realtime connection to the workspace: its members
 * and every instance administrator.
 */
export async function listWorkspaceAudience(
  workspaceId: string,
  database: DbOrTx = db,
) {
  // Sequential: a transaction's connection runs one query at a time.
  const members = await database
    .select({ userId: schema.workspaceUserTable.userId })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId));
  const admins = await database
    .select({ userId: schema.userTable.id })
    .from(schema.userTable)
    .where(instanceAdminRoleSql(schema.userTable.role));
  return [...new Set([...members, ...admins].map((row) => row.userId))];
}
