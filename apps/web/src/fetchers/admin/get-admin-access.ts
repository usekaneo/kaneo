import { authClient } from "@/lib/auth-client";

export async function getAdminAccess() {
  const { data, error } = await authClient.admin.hasPermission({
    permissions: { user: ["list"] },
  });

  if (error) {
    return false;
  }

  return data?.success === true;
}
