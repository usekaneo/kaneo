import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

function getWorkspaceUsers(workspaceId: string) {
  return db
    .select({
      userId: workspaceUserTable.userId,
      userName: userTable.name,
      joinedAt: workspaceUserTable.joinedAt,
      status: workspaceUserTable.status,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .leftJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceUserTable.status));
}

export default getWorkspaceUsers;
