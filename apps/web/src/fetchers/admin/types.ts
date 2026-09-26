import type { getAdminUsers } from "./get-admin-users";

export const ADMIN_USERS_PAGE_SIZE = 20;
export const ADMIN_USERS_SEARCH_MAX_LENGTH = 200;

export type AdminUsersResult = Awaited<ReturnType<typeof getAdminUsers>>;

export type AdminUser = AdminUsersResult["users"][number];

export type UpdateAdminUserRequest = {
  userId: string;
  name: string;
  email: string;
  role?: "admin" | "user";
};

export type ToggleAdminUserStatusRequest = {
  userId: string;
  deactivate: boolean;
};
