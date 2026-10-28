import type { CustomRolePermission } from "@kaneo/permissions";
import type { getAdminRoles } from "./get-admin-roles";

export type AdminRole = Awaited<ReturnType<typeof getAdminRoles>>[number];

export type AdminRoleValues = {
  name: string;
  permissions: CustomRolePermission[];
};
