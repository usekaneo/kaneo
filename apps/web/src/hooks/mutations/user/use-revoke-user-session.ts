import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeUserSession } from "@/fetchers/user/revoke-user-session";
import { USER_SESSIONS_QUERY_KEY } from "@/hooks/queries/user/use-user-sessions";

function useRevokeUserSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeUserSession,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: USER_SESSIONS_QUERY_KEY }),
  });
}

export default useRevokeUserSession;
