import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import {
  hasInstanceAdminRole,
  withInstanceAdminRole,
} from "@/lib/instance-admin";

export type EditUserValues = {
  name: string;
  email: string;
  role: "admin" | "user";
};

type EditableUser = Pick<AdminUser, "id" | "name" | "email" | "role">;

export const EMPTY_EDIT_USER_VALUES: EditUserValues = {
  name: "",
  email: "",
  role: "user",
};

export function getEditUserValues(user: EditableUser): EditUserValues {
  return {
    name: user.name,
    email: user.email,
    role: hasInstanceAdminRole(user.role) ? "admin" : "user",
  };
}

export function buildUserUpdate(
  user: EditableUser,
  values: EditUserValues,
  currentUserId: string | undefined,
) {
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (!name || !email) return null;

  const wantsAdmin = values.role === "admin";
  const roleChanged =
    user.id !== currentUserId && hasInstanceAdminRole(user.role) !== wantsAdmin;

  return {
    userId: user.id,
    name,
    email,
    ...(roleChanged
      ? { role: withInstanceAdminRole(user.role, wantsAdmin) }
      : {}),
  };
}
