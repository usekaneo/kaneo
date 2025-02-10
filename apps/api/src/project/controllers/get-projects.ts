import { and, eq } from 'drizzle-orm';
import db from '../../database';
import { projectTable, workspaceTable } from '../../database/schema';
import type { GetProjectsPayload } from '../db/queries';

async function getProjects({
  workspaceId,
}: Pick<GetProjectsPayload, 'workspaceId'>) {
  const projects = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      description: projectTable.description,
      workspaceId: projectTable.workspaceId,
      createdAt: projectTable.createdAt,
      icon: projectTable.icon,
      slug: projectTable.slug,
      workspace: {
        id: workspaceTable.id,
        name: workspaceTable.name,
      },
    })
    .from(projectTable)
    .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(and(eq(projectTable.workspaceId, workspaceId)));

  return projects;
}

export default getProjects;
