import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import db, { schema } from "../database";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { rolesAllow, satisfies } from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";
import { notBannedCondition } from "../utils/user-ban";
import { parsePermissions } from "../utils/verify-api-key";
import { PROJECT_READ_PERMISSIONS } from "./project-read-permissions";

export async function getProjectReadAccess(
  workspaceId: string,
  recipients: Array<{ userId: string; apiKeyId?: string }>,
  members: Array<{ userId: string; role: string }>,
) {
  const readers = new Set<string>();
  const apiKeys = new Map<string, string>();
  const userIds = [...new Set(recipients.map((conn) => conn.userId))];
  if (userIds.length === 0) return { readers, apiKeys };

  const roleNames = [
    ...new Set(members.flatMap((member) => splitRoles(member.role))),
  ];
  const [users, stored] = await Promise.all([
    db
      .select({ id: schema.userTable.id, role: schema.userTable.role })
      .from(schema.userTable)
      .where(and(inArray(schema.userTable.id, userIds), notBannedCondition())),
    roleNames.length
      ? db
          .select({
            role: schema.workspaceRoleTable.role,
            permission: schema.workspaceRoleTable.permission,
          })
          .from(schema.workspaceRoleTable)
          .where(
            and(
              eq(schema.workspaceRoleTable.workspaceId, workspaceId),
              inArray(schema.workspaceRoleTable.role, roleNames),
            ),
          )
      : [],
  ]);
  const membershipRoles = new Map(
    members.map((member) => [member.userId, member.role]),
  );
  for (const user of users) {
    if (
      hasInstanceAdminRole(user.role) ||
      rolesAllow(
        splitRoles(membershipRoles.get(user.id)),
        stored,
        PROJECT_READ_PERMISSIONS,
      )
    ) {
      readers.add(user.id);
    }
  }

  const apiKeyIds = [
    ...new Set(
      recipients.flatMap((conn) => (conn.apiKeyId ? [conn.apiKeyId] : [])),
    ),
  ];
  if (apiKeyIds.length) {
    const keys = await db
      .select({
        id: schema.apikeyTable.id,
        referenceId: schema.apikeyTable.referenceId,
        userId: schema.apikeyTable.userId,
        permissions: schema.apikeyTable.permissions,
      })
      .from(schema.apikeyTable)
      .where(
        and(
          inArray(schema.apikeyTable.id, apiKeyIds),
          eq(schema.apikeyTable.enabled, true),
          or(
            isNull(schema.apikeyTable.expiresAt),
            gt(schema.apikeyTable.expiresAt, new Date()),
          ),
        ),
      );
    for (const key of keys) {
      const permissions = parsePermissions(key.permissions);
      const owner = key.referenceId ?? key.userId;
      if (
        owner &&
        (!permissions || satisfies(permissions, PROJECT_READ_PERMISSIONS))
      ) {
        apiKeys.set(key.id, owner);
      }
    }
  }
  return { readers, apiKeys };
}
