import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAdminAccess } from "@/fetchers/admin/get-admin-access";

export const ADMIN_ACCESS_QUERY_KEY = ["admin", "access"] as const;

export const adminAccessQueryOptions = queryOptions({
  queryKey: ADMIN_ACCESS_QUERY_KEY,
  queryFn: getAdminAccess,
  staleTime: 5 * 60 * 1000,
});

function useAdminAccess() {
  return useQuery(adminAccessQueryOptions);
}

export default useAdminAccess;
