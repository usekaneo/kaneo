import { eq } from "drizzle-orm";
import db from "../database";
import { userTable, workspaceUserTable } from "../database/schema";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";

export async function listWorkspaceRecipientIds(
  workspaceId: string,
): Promise<string[]> {
  const [members, admins] = await Promise.all([
    db
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, workspaceId)),
    db
      .select({ userId: userTable.id })
      .from(userTable)
      .where(instanceAdminRoleSql(userTable.role)),
  ]);
  return [...new Set([...members, ...admins].map((row) => row.userId))];
}
