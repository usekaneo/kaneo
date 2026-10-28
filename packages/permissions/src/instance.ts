// Instance-wide administration permissions. A user's `role` column holds a
// comma-separated list of instance roles: the built-in `admin` (everything)
// and `user` (nothing), plus custom roles stored by the API.
export const INSTANCE_PERMISSIONS = [
  "users:read",
  "users:create",
  "users:update",
  "users:disable",
  "users:delete",
  "users:credentials",
  "users:sessions",
  "users:api_keys",
  "workspaces:read",
  "workspaces:manage",
  "workspaces:archive",
  "workspaces:delete",
  "audit:read",
  "system:read",
  "instance:settings",
  "roles:manage",
] as const;

export type InstancePermission = (typeof INSTANCE_PERMISSIONS)[number];

export type CustomRolePermission = Exclude<InstancePermission, "roles:manage">;

/** Only the built-in admin role may manage roles; custom roles cannot. */
export const CUSTOM_ROLE_PERMISSIONS = INSTANCE_PERMISSIONS.filter(
  (permission): permission is CustomRolePermission =>
    permission !== "roles:manage",
);

export const BUILT_IN_INSTANCE_ROLES = ["admin", "user"] as const;

export type BuiltInInstanceRole = (typeof BUILT_IN_INSTANCE_ROLES)[number];

/** Custom role names are lowercase slugs so they fit a comma-separated list. */
export const INSTANCE_ROLE_NAME_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export function isInstancePermission(
  value: unknown,
): value is InstancePermission {
  return (INSTANCE_PERMISSIONS as readonly unknown[]).includes(value);
}

export function isCustomRolePermission(
  value: unknown,
): value is CustomRolePermission {
  return (CUSTOM_ROLE_PERMISSIONS as readonly unknown[]).includes(value);
}

export function isBuiltInInstanceRole(
  value: unknown,
): value is BuiltInInstanceRole {
  return (BUILT_IN_INSTANCE_ROLES as readonly unknown[]).includes(value);
}

/**
 * The role names in a user's `role` column. Like better-auth and the API's
 * SQL checks, names are not trimmed: " admin" is not the admin role.
 */
export function parseInstanceRoles(role: string | null | undefined) {
  return (role ?? "").split(",").filter(Boolean);
}
