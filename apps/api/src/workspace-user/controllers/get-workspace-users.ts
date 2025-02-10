import { eq } from 'drizzle-orm';
import db from '../../database';
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from '../../database/schema';

function getWorkspaceUsers({ workspaceId }: { workspaceId: string }) {
  return db
    .select({
      userEmail: userTable.email,
      userName: userTable.name,
      joinedAt: userTable.createdAt,
    })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .innerJoin(
      workspaceUserTable,
      eq(workspaceTable.id, workspaceUserTable.workspaceId),
    )
    .innerJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email))
    .unionAll(
      db
        .select({
          userEmail: userTable.email,
          userName: userTable.name,
          joinedAt: userTable.createdAt,
        })
        .from(workspaceTable)
        .innerJoin(userTable, eq(workspaceTable.ownerEmail, userTable.email))
        .where(eq(workspaceTable.id, workspaceId)),
    );
}

export default getWorkspaceUsers;
