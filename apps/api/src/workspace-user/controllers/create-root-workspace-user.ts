import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function createRootWorkspaceUser(workspaceId: string, userId: string) {
  const [workspaceUser] = await db
    .insert(workspaceUserTable)
    .values({
      workspaceId,
      userId,
      role: "owner",
      status: "active",
    })
    .returning();

  return workspaceUser;
}

export default createRootWorkspaceUser;
