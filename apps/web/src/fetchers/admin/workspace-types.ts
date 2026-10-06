import type { getAdminWorkspaceMembers } from "./get-admin-workspace-members";
import type { getAdminWorkspaces } from "./get-admin-workspaces";

export const ADMIN_WORKSPACES_PAGE_SIZE = 20;
export const ADMIN_WORKSPACES_SEARCH_MAX_LENGTH = 200;

export type AdminWorkspacesResult = Awaited<
  ReturnType<typeof getAdminWorkspaces>
>;

export type AdminWorkspace = AdminWorkspacesResult["workspaces"][number];

export type AdminWorkspaceMember = Awaited<
  ReturnType<typeof getAdminWorkspaceMembers>
>[number];

export type AdminWorkspaceMemberTarget = {
  workspaceId: string;
  userId: string;
};

export type AdminWorkspaceMemberRoleRequest = AdminWorkspaceMemberTarget & {
  role: string;
};
