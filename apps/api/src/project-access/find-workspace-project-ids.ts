import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import type { DbOrTx } from "./db-or-tx";

export async function findWorkspaceProjectIds(
  workspaceId: string,
  projectIds: readonly string[],
  database: DbOrTx = db,
): Promise<string[]> {
  const ids = [...new Set(projectIds)];
  if (ids.length === 0) return [];

  const rows = await database
    .select({ id: schema.projectTable.id })
    .from(schema.projectTable)
    .where(
      and(
        eq(schema.projectTable.workspaceId, workspaceId),
        inArray(schema.projectTable.id, ids),
      ),
    );

  return rows.map((row) => row.id);
}
