import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function deleteWorkspaceUser({
  workspaceId,
  userEmail,
}: { workspaceId: string; userEmail: string }) {
  await db
    .delete(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userEmail, userEmail),
      ),
    );
}

export default deleteWorkspaceUser;
