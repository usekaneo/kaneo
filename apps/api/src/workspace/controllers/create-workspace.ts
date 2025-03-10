import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";

async function createWorkspace(name: string, ownerEmail: string) {
  const [workspace] = await db
    .insert(workspaceTable)
    .values({
      name,
      ownerEmail,
    })
    .returning();

  // TODO: Replace with event
  await db.insert(workspaceUserTable).values({
    workspaceId: workspace.id,
    userEmail: ownerEmail,
    role: "owner",
    status: "active",
  });

  return workspace;
}

export default createWorkspace;
