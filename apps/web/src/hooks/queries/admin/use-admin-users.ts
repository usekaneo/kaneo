import { useQuery } from "@tanstack/react-query";
import { getAdminUsers } from "@/fetchers/admin/get-admin-users";

export {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUser,
} from "@/fetchers/admin/types";

export const ADMIN_USERS_QUERY_KEY = ["admin", "users"] as const;
function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: [...ADMIN_USERS_QUERY_KEY, search, page],
    queryFn: () => getAdminUsers(search, page),
    placeholderData: (previousData) => previousData,
  });
}

export default useAdminUsers;
