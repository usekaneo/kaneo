import { and, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";

async function getWorkspace(userEmail: string, workspaceId: string) {
  const [existingWorkspace] = await db
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerEmail: workspaceTable.ownerEmail,
      description: workspaceTable.description,
      createdAt: workspaceTable.createdAt,
    })
    .from(workspaceTable)
    .leftJoin(
      workspaceUserTable,
      eq(workspaceTable.id, workspaceUserTable.workspaceId),
    )
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        or(
          eq(workspaceTable.ownerEmail, userEmail),
          eq(workspaceUserTable.userEmail, userEmail),
        ),
      ),
    )
    .limit(1);

  const isWorkspaceExisting = Boolean(existingWorkspace);

  if (!isWorkspaceExisting) {
    throw new HTTPException(404, {
      message: "Workspace not found",
    });
  }

  return existingWorkspace;
}

export default getWorkspace;
