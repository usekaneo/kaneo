import { authClient } from "@/lib/auth-client";

export async function deleteAdminUser(userId: string) {
  const { data, error } = await authClient.admin.removeUser({ userId });

  if (error) {
    throw new Error(error.message ?? "");
  }

  return data;
}
