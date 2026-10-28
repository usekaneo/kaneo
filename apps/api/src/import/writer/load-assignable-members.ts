import { eq } from "drizzle-orm";
import type db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";
import { filterUsersWithProjectAccess } from "../../project-access/filter-users-with-project-access";
import type { AssignableMember } from "./match-assignees";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function loadAssignableMembers(
  tx: Transaction,
  workspaceId: string,
  projectId: string,
): Promise<AssignableMember[]> {
  const members = await tx
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId));

  const withAccess = await filterUsersWithProjectAccess(
    members.map((member) => member.id),
    projectId,
    tx,
  );
  return members.filter((member) => withAccess.has(member.id));
}
