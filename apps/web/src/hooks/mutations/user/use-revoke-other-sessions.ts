import { useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_SESSIONS_QUERY_KEY } from "@/hooks/queries/user/use-user-sessions";
import { authClient } from "@/lib/auth-client";

function useRevokeOtherSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.revokeOtherSessions();
      if (error) throw new Error(error.message ?? "");
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: USER_SESSIONS_QUERY_KEY }),
  });
}

export default useRevokeOtherSessions;
