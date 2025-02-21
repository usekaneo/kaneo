import { and, asc, desc, eq, not } from "drizzle-orm";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";

function getWorkspaceUsers({ workspaceId }: { workspaceId: string }) {
  return db
    .select({
      userEmail: workspaceUserTable.userEmail,
      userName: userTable.name,
      joinedAt: workspaceUserTable.joinedAt,
      status: workspaceUserTable.status,
      role: workspaceUserTable.role,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      eq(workspaceTable.id, workspaceUserTable.workspaceId),
    )
    .leftJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email))
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        not(eq(workspaceUserTable.userEmail, workspaceTable.ownerEmail)),
      ),
    )
    .unionAll(
      db
        .select({
          userEmail: workspaceUserTable.userEmail,
          userName: userTable.name,
          joinedAt: workspaceUserTable.joinedAt,
          status: workspaceUserTable.status,
          role: workspaceUserTable.role,
        })
        .from(workspaceTable)
        .where(eq(workspaceTable.id, workspaceId))
        .innerJoin(
          workspaceUserTable,
          and(
            eq(workspaceTable.id, workspaceUserTable.workspaceId),
            eq(workspaceUserTable.userEmail, workspaceTable.ownerEmail),
          ),
        )
        .leftJoin(userTable, eq(workspaceUserTable.userEmail, userTable.email)),
    )
    .orderBy(asc(workspaceUserTable.joinedAt));
}

export default getWorkspaceUsers;
