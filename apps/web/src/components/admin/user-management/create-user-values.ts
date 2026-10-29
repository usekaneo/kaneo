import type { CreateAdminUserRequest } from "@/fetchers/admin/types";

export type CreateUserValues = CreateAdminUserRequest;

export const EMPTY_CREATE_USER_VALUES: CreateUserValues = {
  name: "",
  email: "",
  role: "user",
};

export function buildCreateUserRequest(
  values: CreateUserValues,
): CreateAdminUserRequest | null {
  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (!name || !email) return null;
  return { name, email, role: values.role };
}
