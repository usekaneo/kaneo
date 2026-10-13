import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";

async function listWorkspaceMembers(workspaceId: string) {
  const [workspace] = await db
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  const rows = await db
    .select({
      userId: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
      joinedAt: workspaceUserTable.joinedAt,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(workspaceUserTable.userId, userTable.id))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(workspaceUserTable.joinedAt), asc(userTable.id));

  return rows.map((row) => ({
    ...row,
    joinedAt: row.joinedAt.toISOString(),
  }));
}

export default listWorkspaceMembers;
