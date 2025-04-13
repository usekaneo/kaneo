import { and, eq } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";

async function updateProject(
  id: string,
  workspaceId: string,
  name: string,
  description: string,
  icon: string,
  slug: string,
) {
  const [existingProject] = await db
    .select()
    .from(projectTable)
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    );

  const isProjectExisting = Boolean(existingProject);

  if (!isProjectExisting) {
    throw new Error("Project doesn't exist");
  }

  const [updatedWorkspace] = await db
    .update(projectTable)
    .set({
      name,
      description,
      icon,
      slug,
    })
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    )
    .returning();

  return updatedWorkspace;
}

export default updateProject;
