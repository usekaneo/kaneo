import { useQuery } from "@tanstack/react-query";
import { getAdminUserApiKeys } from "@/fetchers/admin/get-admin-user-api-keys";

export function adminUserApiKeysQueryKey(userId: string) {
  return ["admin", "user-api-keys", userId] as const;
}

function useAdminUserApiKeys(userId: string, enabled = true) {
  return useQuery({
    refetchOnMount: "always",
    queryKey: adminUserApiKeysQueryKey(userId),
    queryFn: () => getAdminUserApiKeys(userId),
    enabled: enabled && userId !== "",
  });
}

export default useAdminUserApiKeys;
