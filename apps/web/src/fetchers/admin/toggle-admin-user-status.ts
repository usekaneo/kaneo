import { authClient } from "@/lib/auth-client";
import type { ToggleAdminUserStatusRequest } from "./types";

export async function toggleAdminUserStatus({
  userId,
  deactivate,
}: ToggleAdminUserStatusRequest) {
  const result = deactivate
    ? await authClient.admin.banUser({
        userId,
        banReason: "Deactivated by an instance administrator",
      })
    : await authClient.admin.unbanUser({ userId });

  if (result.error) {
    throw new Error(result.error.message ?? "");
  }

  return result.data;
}
