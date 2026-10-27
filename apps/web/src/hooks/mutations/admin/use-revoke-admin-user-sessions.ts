import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ADMIN_AUDIT_LOG_QUERY_KEY } from "@/hooks/queries/admin/use-admin-audit-log";
import { revokeAdminUserSessions } from "@/fetchers/admin/revoke-admin-user-sessions";
import { adminUserSessionsQueryKey } from "@/hooks/queries/admin/use-admin-user-sessions";

function useRevokeAdminUserSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAdminUserSessions,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ADMIN_AUDIT_LOG_QUERY_KEY,
        refetchType: "all",
      }),
    onSettled: (_data, _error, userId) =>
      queryClient.invalidateQueries({
        queryKey: adminUserSessionsQueryKey(userId),
      }),
  });
}

export default useRevokeAdminUserSessions;
