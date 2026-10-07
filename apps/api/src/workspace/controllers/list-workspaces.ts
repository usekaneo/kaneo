import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function listWorkspaces(userId: string) {
  const sortName = sql`lower(${workspaceTable.name})`;

  const rows = await db
    .selectDistinctOn([sortName, workspaceTable.id], {
      ...workspaceColumns,
      role: workspaceUserTable.role,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .orderBy(
      sortName,
      workspaceTable.id,
      workspaceUserTable.joinedAt,
      workspaceUserTable.id,
    );

  return rows.map(toWorkspaceResponse);
}

export default listWorkspaces;
