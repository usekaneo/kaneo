import { authClient } from "@/lib/auth-client";
import type { UpdateAdminUserRequest } from "./types";

export async function updateAdminUser({
  userId,
  name,
  email,
  role,
}: UpdateAdminUserRequest) {
  const { data, error } = await authClient.admin.updateUser({
    userId,
    data: { name, email, role },
  });

  if (error) {
    throw new Error(error.message ?? "");
  }

  return data;
}
