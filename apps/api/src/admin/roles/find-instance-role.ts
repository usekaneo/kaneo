import { isCustomRolePermission } from "@kaneo/permissions";
import { eq, sql } from "drizzle-orm";
import { instanceRoleTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

// Qualified by hand: Drizzle leaves columns bare in one-table selects, and a
// bare "name" would resolve to the user's name inside the subquery.
const userCount = sql<number>`(
  SELECT count(*)::int FROM "user" u
  WHERE "instance_role"."name" = ANY(string_to_array(u."role", ','))
)`;

export const instanceRoleColumns = {
  id: instanceRoleTable.id,
  name: instanceRoleTable.name,
  permissions: instanceRoleTable.permissions,
  createdAt: instanceRoleTable.createdAt,
  updatedAt: instanceRoleTable.updatedAt,
  userCount,
};

type InstanceRoleRow = {
  id: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  userCount: number;
};

export function toInstanceRole(row: InstanceRoleRow) {
  return {
    ...row,
    permissions: row.permissions.filter(isCustomRolePermission),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findInstanceRole(roleId: string, database: DbOrTx) {
  const [row] = await database
    .select(instanceRoleColumns)
    .from(instanceRoleTable)
    .where(eq(instanceRoleTable.id, roleId))
    .limit(1);
  return row ? toInstanceRole(row) : undefined;
}
