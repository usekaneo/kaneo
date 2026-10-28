import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminSystemStatus } from "@/fetchers/admin/get-admin-system-status";

export const ADMIN_SYSTEM_STATUS_QUERY_KEY = ["admin", "system"] as const;

function useAdminSystemStatus() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_SYSTEM_STATUS_QUERY_KEY, userId],
    queryFn: getAdminSystemStatus,
    enabled: userId !== "",
    // Each load probes SMTP, storage and Redis: check on open and on request,
    // not every time the window regains focus.
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export default useAdminSystemStatus;
