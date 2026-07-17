export const ADMIN_USERS_PAGE_SIZE = 20;

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null;
  banned: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
};

export type AdminUsersResult = {
  users: AdminUser[];
  total: number;
};

export type UpdateAdminUserRequest = {
  userId: string;
  name: string;
  email: string;
  role: "admin" | "user";
};

export type ToggleAdminUserStatusRequest = {
  userId: string;
  deactivate: boolean;
};
