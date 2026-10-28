import {
  CUSTOM_ROLE_PERMISSIONS,
  INSTANCE_PERMISSIONS,
  type InstancePermission,
  isBuiltInInstanceRole,
  parseInstanceRoles,
} from "@kaneo/permissions";
import { eq, inArray } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable, userTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

export type InstanceAccess = {
  isAdmin: boolean;
  permissions: InstancePermission[];
};

const NO_ACCESS: InstanceAccess = { isAdmin: false, permissions: [] };

/** The built-in admin role grants everything; custom roles what they list. */
export async function getRoleAccess(
  role: string | null | undefined,
  database: DbOrTx = db,
): Promise<InstanceAccess> {
  const names = parseInstanceRoles(role);
  if (names.includes("admin")) {
    return { isAdmin: true, permissions: [...INSTANCE_PERMISSIONS] };
  }
  const custom = names.filter((name) => !isBuiltInInstanceRole(name));
  if (custom.length === 0) return NO_ACCESS;

  const rows = await database
    .select({ permissions: instanceRoleTable.permissions })
    .from(instanceRoleTable)
    .where(inArray(instanceRoleTable.name, custom));
  const granted = new Set(rows.flatMap((row) => row.permissions));
  return {
    isAdmin: false,
    permissions: CUSTOM_ROLE_PERMISSIONS.filter((permission) =>
      granted.has(permission),
    ),
  };
}

/** A user's instance permissions, read fresh from their stored role. */
export async function getUserAccess(userId: string, database: DbOrTx = db) {
  const [user] = await database
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  return user ? getRoleAccess(user.role, database) : NO_ACCESS;
}

/** Whether `access` holds every permission in `permissions`. */
export function holdsAll(
  access: InstanceAccess,
  permissions: readonly string[],
) {
  return (
    access.isAdmin ||
    permissions.every((permission) =>
      (access.permissions as readonly string[]).includes(permission),
    )
  );
}
