import { and, eq } from "drizzle-orm";
import db from "../../database";
import { workspaceUserTable } from "../../database/schema";

async function inviteWorkspaceUser({
  workspaceId,
  userEmail,
}: { workspaceId: string; userEmail: string }) {
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
    throw new Error("User is already invited to this workspace");
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
