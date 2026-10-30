import { and, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { projectAccessCondition } from "./project-access-condition";

export async function findAccessibleProjects(
  viewerId: string,
  projectIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      id: schema.projectTable.id,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.projectTable)
    .where(
      and(
        inArray(schema.projectTable.id, ids),
        projectAccessCondition(viewerId, schema.projectTable.id),
      ),
    );

  return new Map(rows.map((row) => [row.id, row.workspaceId]));
}
