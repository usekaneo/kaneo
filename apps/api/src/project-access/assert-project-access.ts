import { and, inArray, not } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { projectAccessCondition } from "./project-access-condition";

export async function findInaccessibleProjectIds(
  userId: string,
  projectIds: readonly string[],
  database: Pick<typeof db, "select"> = db,
): Promise<string[]> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return [];

  const rows = await database
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        inArray(schema.projectTable.id, ids),
        not(projectAccessCondition(userId, schema.projectTable.id)),
      ),
    );

  return rows.map((row) => row.id);
}

export async function canAccessProject(userId: string, projectId: string) {
  return (await findInaccessibleProjectIds(userId, [projectId])).length === 0;
}

export async function assertProjectAccess(
  userId: string,
  projectIds: string | readonly string[],
): Promise<void> {
  const ids = typeof projectIds === "string" ? [projectIds] : projectIds;
  const denied = await findInaccessibleProjectIds(userId, ids);
  if (denied.length > 0) {
    throw new HTTPException(403, {
      message: "You don't have access to this project",
    });
  }
}
