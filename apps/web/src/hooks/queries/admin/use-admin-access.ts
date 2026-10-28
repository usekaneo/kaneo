import type { InstancePermission } from "@kaneo/permissions";
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

/**
 * The signed-in user's instance permissions, for showing admin pages and
 * actions. The API checks every request itself.
 */
function useAdminAccess() {
  const { user } = useAuth();
  const query = useQuery(adminAccessQueryOptions(user?.id));
  const permissions = query.data ?? [];
  return {
    ...query,
    permissions,
    can: (permission: InstancePermission) => permissions.includes(permission),
  };
}

export default useAdminAccess;
