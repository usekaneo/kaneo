import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

function getWorkspaceUsers(workspaceId: string) {
  return db
    .select({
      userEmail: workspaceUserTable.userEmail,
      userName: userTable.name,
      joinedAt: workspaceUserTable.joinedAt,
      status: workspaceUserTable.status,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .leftJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceUserTable.status));
}

export default getWorkspaceUsers;
