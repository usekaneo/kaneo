import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeAdminUserSessions } from "@/fetchers/admin/revoke-admin-user-sessions";
import { adminUserSessionsQueryKey } from "@/hooks/queries/admin/use-admin-user-sessions";

function useRevokeAdminUserSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAdminUserSessions,
    onSettled: (_data, _error, userId) =>
      queryClient.invalidateQueries({
        queryKey: adminUserSessionsQueryKey(userId),
      }),
  });
}

export default useRevokeAdminUserSessions;
