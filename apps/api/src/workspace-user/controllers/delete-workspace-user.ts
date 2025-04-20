import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function deleteWorkspaceUser(workspaceId: string, userEmail: string) {
  const [deletedWorkspaceUser] = await db
    .delete(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userEmail, userEmail),
      ),
    )
    .returning();

  return deletedWorkspaceUser;
}

export default deleteWorkspaceUser;
