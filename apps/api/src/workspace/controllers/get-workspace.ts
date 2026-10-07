import { and, eq, isNotNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { instanceAdminRoleSql } from "../../utils/instance-admin-role";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function getWorkspace(workspaceId: string, userId: string) {
  const [row] = await db
    .select({ ...workspaceColumns, role: workspaceUserTable.role })
    .from(workspaceTable)
    .innerJoin(userTable, eq(userTable.id, userId))
    .leftJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userTable.id),
      ),
    )
    .where(
      and(
        eq(workspaceTable.id, workspaceId),
        or(
          isNotNull(workspaceUserTable.id),
          instanceAdminRoleSql(userTable.role),
        ),
      ),
    )
    .orderBy(workspaceUserTable.joinedAt, workspaceUserTable.id)
    .limit(1);

  if (!row) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }

  return toWorkspaceResponse(row);
}

export default getWorkspace;
