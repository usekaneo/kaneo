import { useQuery } from "@tanstack/react-query";
import { getUserSessions } from "@/fetchers/user/get-user-sessions";

export const USER_SESSIONS_QUERY_KEY = ["user", "sessions"] as const;

function useUserSessions() {
  return useQuery({
    refetchOnMount: "always",
    queryKey: USER_SESSIONS_QUERY_KEY,
    queryFn: getUserSessions,
  });
}

export default useUserSessions;
