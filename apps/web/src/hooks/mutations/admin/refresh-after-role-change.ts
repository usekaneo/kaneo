import type { QueryClient } from "@tanstack/react-query";
import { ADMIN_ACCESS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-access";
import { ADMIN_ROLES_QUERY_KEY } from "@/hooks/queries/admin/use-admin-roles";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";

/** Role names and permissions show up in the directory and in your access. */
export function refreshAfterRoleChange(queryClient: QueryClient) {
  for (const queryKey of [
    ADMIN_ROLES_QUERY_KEY,
    ADMIN_USERS_QUERY_KEY,
    ADMIN_ACCESS_QUERY_KEY,
  ]) {
    queryClient.invalidateQueries({ queryKey });
  }
}
