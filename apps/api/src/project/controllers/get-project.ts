import { and, eq } from "drizzle-orm";
import db from "../../database";
import { projectTable, workspaceTable } from "../../database/schema";

async function getProject(id: string, workspaceId: string) {
  const [project] = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      description: projectTable.description,
      workspaceId: projectTable.workspaceId,
      workspace: workspaceTable,
    })
    .from(projectTable)
    .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(
      and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
    );

  return project;
}

export default getProject;
