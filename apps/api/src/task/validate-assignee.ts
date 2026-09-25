import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { projectTable, workspaceUserTable } from "../database/schema";

export async function assertProjectAssignee(projectId: string, userId: string) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .innerJoin(
      projectTable,
      eq(projectTable.workspaceId, workspaceUserTable.workspaceId),
    )
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  if (!member) {
    throw new HTTPException(400, {
      message: "Assignee must be a current workspace member",
    });
  }
}
