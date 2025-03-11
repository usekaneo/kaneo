import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function createRootWorkspaceUser({
  workspaceId,
  userEmail,
}: { workspaceId: string; userEmail: string }) {
  const [workspaceUser] = await db
    .insert(workspaceUserTable)
    .values({
      workspaceId,
      userEmail,
      role: "owner",
      status: "active",
    })
    .returning();

  return workspaceUser;
}

export default createRootWorkspaceUser;
