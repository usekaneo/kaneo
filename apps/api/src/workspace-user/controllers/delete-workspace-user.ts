import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function deleteWorkspaceUser(workspaceId: string, userId: string) {
  const [deletedWorkspaceUser] = await db
    .delete(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .returning();

  return deletedWorkspaceUser;
}

export default deleteWorkspaceUser;
