import { useQuery } from "@tanstack/react-query";
import { getAdminUserSessions } from "@/fetchers/admin/get-admin-user-sessions";

export function adminUserSessionsQueryKey(userId: string) {
  return ["admin", "user-sessions", userId] as const;
}

function useAdminUserSessions(userId: string, enabled = true) {
  return useQuery({
    queryKey: adminUserSessionsQueryKey(userId),
    queryFn: () => getAdminUserSessions(userId),
    enabled: enabled && userId !== "",
  });
}

export default useAdminUserSessions;
