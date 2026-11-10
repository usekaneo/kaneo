import { sql } from "drizzle-orm";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** Privileged platform queries: the function exposes storage references only. */
export async function listQuillsWorkspaceObjectKeys(
  workspaceId: string,
  database: DbOrTx,
) {
  const result = await database.execute<{ object_key: string }>(
    sql`SELECT object_key FROM quills.storage_keys_for_workspace(${workspaceId}) AS object_key`,
  );
  return result.rows.map((row) => row.object_key);
}

export async function isQuillsStorageObjectReferenced(
  objectKey: string,
  database: DbOrTx,
) {
  const result = await database.execute(
    sql`SELECT 1 WHERE quills.storage_object_is_referenced(${objectKey})`,
  );
  return result.rows.length > 0;
}
