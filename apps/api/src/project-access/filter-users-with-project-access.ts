import { and, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { projectAccessCondition } from "./project-access-condition";

export async function filterUsersWithProjectAccess(
  userIds: Iterable<string>,
  projectId: string,
  database: Pick<typeof db, "select"> = db,
): Promise<Set<string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Set();

  const rows = await database
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(
      and(
        inArray(schema.userTable.id, ids),
        projectAccessCondition(schema.userTable.id, projectId),
      ),
    );

  return new Set(rows.map((row) => row.id));
}
