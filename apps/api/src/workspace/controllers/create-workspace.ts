import { HTTPException } from "hono/http-exception";
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

  if (!workspace) {
    throw new HTTPException(500, {
      message: "Failed to create workspace",
    });
  }

  publishEvent("workspace.created", {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    ownerEmail,
  });

  return workspace;
}

export default createWorkspace;
