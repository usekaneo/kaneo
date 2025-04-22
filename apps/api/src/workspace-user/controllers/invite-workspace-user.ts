import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";

async function inviteWorkspaceUser(workspaceId: string, userEmail: string) {
  const [workspace] = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId));

  if (!workspace) {
    throw new HTTPException(404, {
      message: "Workspace not found",
    });
  }

  const [existingUser] = await db
    .select()
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userEmail, userEmail),
      ),
    );

  if (existingUser) {
    throw new HTTPException(400, {
      message: "User is already invited to this workspace",
    });
  }

  const [invitedUser] = await db
    .insert(workspaceUserTable)
    .values({
      userEmail,
      workspaceId,
    })
    .returning();

  return invitedUser;
}

export default inviteWorkspaceUser;
