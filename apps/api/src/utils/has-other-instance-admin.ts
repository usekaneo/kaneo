import { count, sql } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import { instanceAdminRoleSql } from "./instance-admin-role";

/**
 * Whether an admin would remain after one loses the role. Call inside the
 * transaction that removes it: the advisory lock serializes removals across
 * API instances, so two admins can't demote each other at the same time.
 */
export async function hasOtherInstanceAdmin(tx: DbOrTx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(2026, 1732)`);
  const [admins] = await tx
    .select({ value: count() })
    .from(schema.userTable)
    .where(instanceAdminRoleSql(schema.userTable.role));
  return (admins?.value ?? 0) > 1;
}
