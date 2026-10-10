import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminWorkspaces } from "@/fetchers/admin/get-admin-workspaces";

export {
  ADMIN_WORKSPACES_PAGE_SIZE,
  ADMIN_WORKSPACES_SEARCH_MAX_LENGTH,
  type AdminWorkspace,
} from "@/fetchers/admin/workspace-types";

export const ADMIN_WORKSPACES_QUERY_KEY = ["admin", "workspaces"] as const;

function useAdminWorkspaces(search: string, page: number) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_WORKSPACES_QUERY_KEY, userId, search.trim(), page],
    queryFn: () => getAdminWorkspaces(search, page),
    enabled: userId !== "",
    placeholderData: (previousData, previousQuery) =>
      userId !== "" && previousQuery?.queryKey[2] === userId
        ? previousData
        : undefined,
  });
}

export default useAdminWorkspaces;
