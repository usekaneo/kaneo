import db from "../../database";
import { workspaceTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createWorkspace(name: string, ownerEmail: string) {
  const [workspace] = await db
    .insert(workspaceTable)
    .values({
      name,
      ownerEmail,
    })
    .returning();

  publishEvent("workspace.created", {
    workspaceId: workspace.id,
    ownerEmail,
  });

  return workspace;
}

export default createWorkspace;
