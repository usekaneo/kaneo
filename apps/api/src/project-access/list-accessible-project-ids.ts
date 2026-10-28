import { and, eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";
import { projectAccessCondition } from "./project-access-condition";

export async function listAccessibleProjectIds(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
): Promise<Set<string>> {
  const rows = await database
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, schema.projectTable.id),
      ),
    );
  return new Set(rows.map((row) => row.id));
}
