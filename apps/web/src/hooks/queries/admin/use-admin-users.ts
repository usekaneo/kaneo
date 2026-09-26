import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminUsers } from "@/fetchers/admin/get-admin-users";

export {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUser,
} from "@/fetchers/admin/types";

export const ADMIN_USERS_QUERY_KEY = ["admin", "users"] as const;

function useAdminUsers(search: string, page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, user?.id ?? "", search.trim(), page],
    queryFn: () => getAdminUsers(search, page),
    enabled: Boolean(user?.id),
    placeholderData: (previousData) => previousData,
  });
}

export default useAdminUsers;
