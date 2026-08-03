import { type DefaultRoleName, defaultRolePayloads } from "@kaneo/permissions";

export const DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION = 1;

export function createDefaultWorkspaceRoleInsert(
  workspaceId: string,
  role: DefaultRoleName,
  now: Date,
) {
  return {
    workspaceId,
    role,
    permission: JSON.stringify(defaultRolePayloads[role]),
    permissionUpgradeVersion: DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION,
    createdAt: now,
    updatedAt: now,
  };
}
