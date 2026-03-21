import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function unarchiveProject(id: string, workspaceId: string) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    );

  if (!existingProject) {
    throw new HTTPException(404, {
      message:
        "Project doesn't exist or doesn't belong to the specified workspace",
    });
  }

  const [unarchivedProject] = await db
    .update(projectTable)
    .set({ archivedAt: null })
    .where(eq(projectTable.id, id))
    .returning();

  if (!unarchivedProject) {
    throw new HTTPException(500, {
      message: "Failed to unarchive project",
    });
  }

  return unarchivedProject;
}

export default unarchiveProject;
