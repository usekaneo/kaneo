import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../database";
import { hasInstanceAdminRole } from "./instance-admin-role";
import {
  type PermissionMap,
  rolesAllow,
  satisfies,
  type StoredRolePermission,
} from "./role-permissions";
import { splitRoles } from "./split-roles";
import { notBannedCondition } from "./user-ban";

// Resolve current grants once for a request spanning multiple workspaces.
// Role rows must stay grouped by workspace: the same role name can differ.
export async function workspacePermissionGrants(
  userId: string,
  {
    apiKeyPermissions,
    workspaceIds,
  }: {
    apiKeyPermissions?: PermissionMap | null;
    workspaceIds?: string[];
  } = {},
) {
  const [users, members] = await Promise.all([
    db
      .select({ role: schema.userTable.role })
      .from(schema.userTable)
      .where(and(eq(schema.userTable.id, userId), notBannedCondition()))
      .limit(1),
    db
      .select({
        workspaceId: schema.workspaceUserTable.workspaceId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, userId),
          workspaceIds
            ? inArray(schema.workspaceUserTable.workspaceId, workspaceIds)
            : undefined,
        ),
      ),
  ]);
  const isInstanceAdmin = hasInstanceAdminRole(users[0]?.role);
  const memberRoles = new Map(
    members.map((member) => [member.workspaceId, splitRoles(member.role)]),
  );
  const memberWorkspaceIds = [...memberRoles.keys()];
  const roleNames = [...new Set([...memberRoles.values()].flat())];
  const stored =
    !isInstanceAdmin && memberWorkspaceIds.length && roleNames.length
      ? await db
          .select({
            workspaceId: schema.workspaceRoleTable.workspaceId,
            role: schema.workspaceRoleTable.role,
            permission: schema.workspaceRoleTable.permission,
          })
          .from(schema.workspaceRoleTable)
          .where(
            and(
              inArray(
                schema.workspaceRoleTable.workspaceId,
                memberWorkspaceIds,
              ),
              inArray(schema.workspaceRoleTable.role, roleNames),
            ),
          )
      : [];
  const storedByWorkspace = new Map<string, StoredRolePermission[]>();
  for (const row of stored) {
    const rows = storedByWorkspace.get(row.workspaceId) ?? [];
    rows.push(row);
    storedByWorkspace.set(row.workspaceId, rows);
  }

  return {
    isInstanceAdmin,
    workspaceIds: memberWorkspaceIds,
    allows(workspaceId: string, permissions: PermissionMap) {
      if (!users.length) return false;
      if (apiKeyPermissions && !satisfies(apiKeyPermissions, permissions)) {
        return false;
      }
      return (
        isInstanceAdmin ||
        rolesAllow(
          memberRoles.get(workspaceId) ?? [],
          storedByWorkspace.get(workspaceId) ?? [],
          permissions,
        )
      );
    },
  };
}
