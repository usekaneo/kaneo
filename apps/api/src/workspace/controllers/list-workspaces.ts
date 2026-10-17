import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { workspaceAccessColumns } from "../can-read-workspace";
import { filterReadableWorkspaces } from "../filter-readable-workspaces";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function listWorkspaces(userId: string) {
  const sortName = sql`lower(${workspaceTable.name})`;

  const rows = await db
    .selectDistinctOn([sortName, workspaceTable.id], {
      ...workspaceColumns,
      ...workspaceAccessColumns,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .orderBy(
      sortName,
      workspaceTable.id,
      workspaceUserTable.joinedAt,
      workspaceUserTable.id,
    );

  return (await filterReadableWorkspaces(rows)).map(toWorkspaceResponse);
}

export default listWorkspaces;
