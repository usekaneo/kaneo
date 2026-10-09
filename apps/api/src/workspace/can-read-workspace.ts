import { sql } from "drizzle-orm";
import { userTable, workspaceUserTable } from "../database/schema";
import { instanceAdminRoleSql } from "../utils/instance-admin-role";
import {
  rolesAllow,
  type StoredRolePermission,
} from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";

export const workspaceAccessColumns = {
  role: workspaceUserTable.role,
  instanceAdmin: sql<boolean>`coalesce(${instanceAdminRoleSql(userTable.role)}, false)`,
};

export type WorkspaceAccess = {
  role: string | null;
  instanceAdmin: boolean;
};

export function canReadWorkspace(
  access: WorkspaceAccess,
  storedRoles: readonly StoredRolePermission[],
) {
  if (access.instanceAdmin) return true;
  return rolesAllow(splitRoles(access.role), storedRoles, {
    workspace: ["read"],
  });
}
