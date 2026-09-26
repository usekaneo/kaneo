import { queryOptions, useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminAccess } from "@/fetchers/admin/get-admin-access";

export const ADMIN_ACCESS_QUERY_KEY = ["admin", "access"] as const;

export function adminAccessQueryOptions(userId: string | null | undefined) {
  return queryOptions({
    queryKey: [...ADMIN_ACCESS_QUERY_KEY, userId ?? ""],
    queryFn: getAdminAccess,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

function useAdminAccess() {
  const { user } = useAuth();
  return useQuery(adminAccessQueryOptions(user?.id));
}

export default useAdminAccess;
