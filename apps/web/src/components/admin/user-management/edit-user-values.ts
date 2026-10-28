import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { getPrimaryInstanceRole } from "./get-primary-instance-role";

export type EditUserValues = {
  name: string;
  email: string;
  role: string;
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
    role: getPrimaryInstanceRole(user.role),
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

  const roleChanged =
    user.id !== currentUserId &&
    getPrimaryInstanceRole(user.role) !== values.role;

  return {
    userId: user.id,
    name,
    email,
    ...(roleChanged ? { role: values.role } : {}),
  };
}
