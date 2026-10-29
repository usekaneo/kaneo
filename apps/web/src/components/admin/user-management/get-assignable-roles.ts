import type { InstancePermission } from "@kaneo/permissions";
import type { AdminRole } from "@/fetchers/admin/role-types";

/**
 * Roles the viewer may give someone, mirroring the API: admin only from an
 * admin, and custom roles only within the viewer's own permissions. The
 * current role stays listed so the picker can show it.
 */
export function getAssignableRoles(
  roles: readonly Pick<AdminRole, "name" | "permissions">[],
  viewer: readonly InstancePermission[],
  current: string,
) {
  const isAdmin = viewer.includes("roles:manage");
  const custom = roles
    .filter(
      (role) =>
        role.name === current ||
        isAdmin ||
        role.permissions.every((permission) => viewer.includes(permission)),
    )
    .map((role) => role.name);
  return [
    "user",
    ...(isAdmin || current === "admin" ? ["admin"] : []),
    ...custom,
  ];
}
