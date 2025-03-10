import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceTable } from "../../database/schema";

async function deleteWorkspace(userEmail: string, workspaceId: string) {
  const [existingWorkspace] = await db
    .select({
      id: workspaceTable.id,
      ownerEmail: workspaceTable.ownerEmail,
    })
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        eq(workspaceTable.ownerEmail, userEmail),
      ),
    )
    .limit(1);

  const isWorkspaceExisting = Boolean(existingWorkspace);

  if (!isWorkspaceExisting) {
    throw new Error("Workspace not found or access denied");
  }

  const [deletedWorkspace] = await db
    .delete(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .returning({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerEmail: workspaceTable.ownerEmail,
      createdAt: workspaceTable.createdAt,
    });

  return deletedWorkspace;
}

export default deleteWorkspace;
