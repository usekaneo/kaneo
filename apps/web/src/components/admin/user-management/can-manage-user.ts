import {
  INSTANCE_PERMISSIONS,
  type InstancePermission,
  parseInstanceRoles,
} from "@kaneo/permissions";
import type { AdminRole } from "@/fetchers/admin/role-types";

/**
 * Mirrors the API: only admins act on users holding permissions the viewer
 * lacks. Hiding the actions is cosmetic; the API decides.
 */
export function canManageUser(
  role: string | null,
  roles: readonly Pick<AdminRole, "name" | "permissions">[],
  viewer: readonly InstancePermission[],
) {
  if (viewer.includes("roles:manage")) return true;
  const names = parseInstanceRoles(role);
  const held: readonly InstancePermission[] = names.includes("admin")
    ? INSTANCE_PERMISSIONS
    : roles
        .filter((custom) => names.includes(custom.name))
        .flatMap((custom) => custom.permissions);
  return held.every((permission) => viewer.includes(permission));
}
