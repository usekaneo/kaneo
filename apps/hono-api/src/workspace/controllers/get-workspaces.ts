import { eq, or } from "drizzle-orm";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";

async function getWorkspaces(userEmail: string) {
  const workspaces = await db
    .select({
      id: workspaceTable.id,
      name: workspaceTable.name,
      ownerEmail: workspaceTable.ownerEmail,
      createdAt: workspaceTable.createdAt,
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

  return workspaces;
}

export default getWorkspaces;
