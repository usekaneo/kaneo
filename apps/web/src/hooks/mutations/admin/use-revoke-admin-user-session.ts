import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeAdminUserSession } from "@/fetchers/admin/revoke-admin-user-session";
import { adminUserSessionsQueryKey } from "@/hooks/queries/admin/use-admin-user-sessions";

function useRevokeAdminUserSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeAdminUserSession,
    onSettled: (_data, _error, { userId }) =>
      queryClient.invalidateQueries({
        queryKey: adminUserSessionsQueryKey(userId),
      }),
  });
}

export default useRevokeAdminUserSession;
