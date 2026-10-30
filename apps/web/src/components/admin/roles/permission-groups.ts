import type { CustomRolePermission } from "@kaneo/permissions";

type PermissionGroup = {
  id: string;
  labelKey: string;
  permissions: { permission: CustomRolePermission; labelKey: string }[];
};

/** Custom role permissions as the role dialog groups them. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "users",
    labelKey: "settings:adminRoles.groups.users",
    permissions: [
      {
        permission: "users:read",
        labelKey: "settings:adminRoles.permissions.usersRead",
      },
      {
        permission: "users:create",
        labelKey: "settings:adminRoles.permissions.usersCreate",
      },
      {
        permission: "users:update",
        labelKey: "settings:adminRoles.permissions.usersUpdate",
      },
      {
        permission: "users:disable",
        labelKey: "settings:adminRoles.permissions.usersDisable",
      },
      {
        permission: "users:delete",
        labelKey: "settings:adminRoles.permissions.usersDelete",
      },
      {
        permission: "users:credentials",
        labelKey: "settings:adminRoles.permissions.usersCredentials",
      },
      {
        permission: "users:sessions",
        labelKey: "settings:adminRoles.permissions.usersSessions",
      },
      {
        permission: "users:api_keys",
        labelKey: "settings:adminRoles.permissions.usersApiKeys",
      },
    ],
  },
  {
    id: "workspaces",
    labelKey: "settings:adminRoles.groups.workspaces",
    permissions: [
      {
        permission: "workspaces:read",
        labelKey: "settings:adminRoles.permissions.workspacesRead",
      },
      {
        permission: "workspaces:manage",
        labelKey: "settings:adminRoles.permissions.workspacesManage",
      },
      {
        permission: "workspaces:archive",
        labelKey: "settings:adminRoles.permissions.workspacesArchive",
      },
      {
        permission: "workspaces:delete",
        labelKey: "settings:adminRoles.permissions.workspacesDelete",
      },
    ],
  },
  {
    id: "instance",
    labelKey: "settings:adminRoles.groups.instance",
    permissions: [
      {
        permission: "audit:read",
        labelKey: "settings:adminRoles.permissions.auditRead",
      },
      {
        permission: "system:read",
        labelKey: "settings:adminRoles.permissions.systemRead",
      },
      {
        permission: "instance:settings",
        labelKey: "settings:adminRoles.permissions.instanceSettings",
      },
    ],
  },
];
