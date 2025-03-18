import { and, eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

function getActiveWorkspaceUsers(workspaceId: string) {
  return db
    .select()
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.status, "active"),
      ),
    )
    .innerJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email));
}

export default getActiveWorkspaceUsers;
