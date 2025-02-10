import { and, eq } from 'drizzle-orm';
import db from '../../database';
import { projectTable } from '../../database/schema';
import type { UpdateProjectPayload } from '../db/queries';

async function updateProject({
  id,
  workspaceId,
  name,
  description,
}: UpdateProjectPayload) {
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
    })
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    )
    .returning();

  return updatedWorkspace;
}

export default updateProject;
