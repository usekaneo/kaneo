import { isBuiltInInstanceRole } from "@kaneo/permissions";
import { and, eq, ne, sql } from "drizzle-orm";
import { instanceRoleTable, userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import type { DbOrTx } from "../../project-access/db-or-tx";

/**
 * Names are unique and can't shadow a built-in role. The transaction lock
 * makes concurrent creates and renames of the same name wait for each other.
 */
export async function assertRoleNameAvailable(
  name: string,
  tx: DbOrTx,
  exceptRoleId?: string,
) {
  if (isBuiltInInstanceRole(name)) {
    throw new ApiError(409, {
      code: "ROLE_NAME_RESERVED",
      message: "This name is reserved for a built-in role.",
    });
  }
  await tx.execute(sql`SELECT pg_advisory_xact_lock(2026, 1813)`);
  const [existing] = await tx
    .select({ id: instanceRoleTable.id })
    .from(instanceRoleTable)
    .where(
      and(
        eq(instanceRoleTable.name, name),
        exceptRoleId ? ne(instanceRoleTable.id, exceptRoleId) : undefined,
      ),
    )
    .limit(1);
  if (existing) {
    throw new ApiError(409, {
      code: "ROLE_NAME_TAKEN",
      message: "A role with this name already exists.",
    });
  }
  const [assigned] = await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(sql`${name} = ANY(string_to_array(${userTable.role}, ','))`)
    .limit(1);
  if (assigned) {
    throw new ApiError(409, {
      code: "ROLE_NAME_IN_USE",
      message: "Users already have this role name. Change their role first.",
    });
  }
}
