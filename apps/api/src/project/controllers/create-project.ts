import db from '../../database';
import { projectTable } from '../../database/schema';
import type { CreateProjectPayload } from '../db/queries';

async function createProject(
  body: Pick<CreateProjectPayload, 'name' | 'slug' | 'workspaceId' | 'icon'>,
) {
  const [createdProject] = await db
    .insert(projectTable)
    .values(body)
    .returning();

  return createdProject;
}

export default createProject;
