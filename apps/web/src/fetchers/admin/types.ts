import type { getAdminUsers } from "./get-admin-users";

export const ADMIN_USERS_PAGE_SIZE = 20;
export const ADMIN_USERS_SEARCH_MAX_LENGTH = 200;

export type AdminUsersResult = Awaited<ReturnType<typeof getAdminUsers>>;

export type AdminUser = AdminUsersResult["users"][number];

export type UpdateAdminUserRequest = {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
};

export type ToggleAdminUserStatusRequest = {
  userId: string;
  deactivate: boolean;
};

export type AdminUserFilters = {
  status?: "active" | "deactivated";
  role?: string;
  emailVerified?: "true" | "false";
};

export type CreateAdminUserRequest = {
  name: string;
  email: string;
  role: string;
};

export type SetAdminUserAvatarRequest = {
  userId: string;
  contentType: string;
  data: string;
};
