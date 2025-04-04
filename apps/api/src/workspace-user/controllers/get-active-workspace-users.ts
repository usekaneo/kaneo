import { and, eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

async function getActiveWorkspaceUsers(workspaceId: string) {
  const activeWorkspaceUsers = await db
    .select({
      id: workspaceUserTable.id,
      userEmail: workspaceUserTable.userEmail,
      userName: userTable.name,
      role: workspaceUserTable.role,
      status: workspaceUserTable.status,
    })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.status, "active"),
      ),
    )
    .innerJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email));

  return activeWorkspaceUsers;
}

export default getActiveWorkspaceUsers;
