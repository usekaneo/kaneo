import { and, inArray, not } from "drizzle-orm";
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
