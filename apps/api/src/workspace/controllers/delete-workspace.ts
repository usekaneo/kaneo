import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable } from "../../database/schema";

async function deleteWorkspace(userId: string, workspaceId: string) {
  const [existingWorkspace] = await db
    .select({
      id: workspaceTable.id,
      ownerId: workspaceTable.ownerId,
    })
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        eq(workspaceTable.ownerId, userId),
      ),
    )
    .limit(1);

  const isWorkspaceExisting = Boolean(existingWorkspace);

  if (!isWorkspaceExisting) {
    throw new HTTPException(404, {
      message: "Workspace not found",
    });
  }

  const [deletedWorkspace] = await db
    .delete(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .returning({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerId: workspaceTable.ownerId,
      createdAt: workspaceTable.createdAt,
    });

  return deletedWorkspace;
}

export default deleteWorkspace;
