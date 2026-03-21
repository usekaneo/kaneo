import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable, workspaceUserTable } from "../../database/schema";

async function getWorkspaceMembers(workspaceId: string) {
  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId));

  return members;
}

export default getWorkspaceMembers;
