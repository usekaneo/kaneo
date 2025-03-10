import { eq, or } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";

async function getWorkspaces(userEmail: string) {
  const workspaces = await db
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerEmail: workspaceTable.ownerEmail,
    })
    .from(workspaceTable)
    .leftJoin(
      workspaceUserTable,
      eq(workspaceTable.id, workspaceUserTable.workspaceId),
    )
    .where(
      or(
        eq(workspaceTable.ownerEmail, userEmail),
        eq(workspaceUserTable.userEmail, userEmail),
      ),
    )
    .groupBy(workspaceTable.id, workspaceTable.name, workspaceTable.ownerEmail);

  const workspacesWithProjects = await Promise.all(
    workspaces.map(async (workspace) => ({
      ...workspace,
      projects: await db
        .select({
          id: projectTable.id,
          name: projectTable.name,
        })
        .from(projectTable)
        .where(eq(projectTable.workspaceId, workspace.id)),
    })),
  );

  return workspacesWithProjects;
}

export default getWorkspaces;
