import { and, eq } from 'drizzle-orm';
import db from '../../database';
import { projectTable } from '../../database/schema';
import type { DeleteProjectPayload } from '../db/queries';

async function deleteProject({
  id,
  workspaceId,
}: Pick<DeleteProjectPayload, 'id' | 'workspaceId'>) {
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

  const [deletedProject] = await db
    .delete(projectTable)
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    )
    .returning();

  return deletedProject;
}

export default deleteProject;
