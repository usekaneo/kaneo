import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";
import type { CreateWorkspacePayload } from "../db/queries";

async function createWorkspace(body: CreateWorkspacePayload) {
  const [workspace] = await db.insert(workspaceTable).values(body).returning();
  await db.insert(workspaceUserTable).values({
    workspaceId: workspace.id,
    userEmail: body.ownerEmail,
    role: "owner",
    status: "active",
  });
  return workspace;
}

export default createWorkspace;
