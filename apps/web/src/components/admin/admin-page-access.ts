import type { InstancePermission } from "@kaneo/permissions";

export const ADMIN_PAGE_PERMISSIONS = {
  "/dashboard/settings/admin/overview": [
    "users:read",
    "workspaces:read",
    "audit:read",
    "system:read",
  ],
  "/dashboard/settings/admin/users": ["users:read"],
  "/dashboard/settings/admin/roles": ["roles:manage"],
  "/dashboard/settings/admin/workspaces": ["workspaces:read"],
  "/dashboard/settings/admin/audit-log": ["audit:read"],
  "/dashboard/settings/admin/system": ["system:read"],
  "/dashboard/settings/admin/settings": ["instance:settings"],
} as const satisfies Record<string, readonly InstancePermission[]>;

export type AdminPage = keyof typeof ADMIN_PAGE_PERMISSIONS;

export function canAccessAdminPage(
  page: AdminPage,
  permissions: readonly InstancePermission[],
) {
  return ADMIN_PAGE_PERMISSIONS[page].every((permission) =>
    permissions.includes(permission),
  );
}

export function getAdminPageRedirect(
  pathname: string,
  permissions: readonly InstancePermission[],
) {
  const page = pathname.replace(/\/$/, "") as AdminPage;
  if (page in ADMIN_PAGE_PERMISSIONS && canAccessAdminPage(page, permissions))
    return null;
  return (
    (Object.keys(ADMIN_PAGE_PERMISSIONS) as AdminPage[]).find((candidate) =>
      canAccessAdminPage(candidate, permissions),
    ) ?? "/dashboard/settings/account/information"
  );
}
