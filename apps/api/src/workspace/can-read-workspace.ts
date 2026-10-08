import { sql } from "drizzle-orm";
import {
  userTable,
  workspaceRoleTable,
  workspaceUserTable,
} from "../database/schema";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";
import { roleAllows } from "../utils/role-permissions";

export const workspaceAccessColumns = {
  role: workspaceUserTable.role,
  rolePermission: workspaceRoleTable.permission,
  instanceAdmin: sql<boolean>`coalesce(${instanceAdminRoleSql(userTable.role)}, false)`,
};

export function canReadWorkspace(row: {
  role: string | null;
  rolePermission: string | null;
  instanceAdmin: boolean;
}) {
  if (row.instanceAdmin) return true;
  return (
    row.role !== null &&
    roleAllows(row.role, row.rolePermission, { workspace: ["read"] })
  );
}
