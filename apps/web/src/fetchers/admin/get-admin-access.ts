import { authClient } from "@/lib/auth-client";

export async function getAdminAccess() {
  const { data, error } = await authClient.admin.hasPermission({
    permissions: { user: ["list"] },
  });

  if (error) {
    if (error.status === 401 || error.status === 403) {
      return false;
    }
    throw new Error(error.message ?? "");
  }

  return data?.success === true;
}
