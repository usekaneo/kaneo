import db from '../../database';
import { workspaceUserTable } from '../../database/schema';

async function inviteWorkspaceUser({
  workspaceId,
  userEmail,
}: {
  workspaceId: string;
  userEmail: string;
}) {
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
