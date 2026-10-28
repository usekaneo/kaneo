import { useQuery } from "@tanstack/react-query";
import getWorkspace from "@/fetchers/workspace/get-workspace";
import { isWorkspaceArchivedError } from "@/lib/is-workspace-archived-error";

export const workspaceStatusQueryKey = (workspaceId: string) =>
  ["workspace-status", workspaceId] as const;

/**
 * Whether the workspace in the URL was archived by an instance administrator.
 * Pages keep rendering while this loads so boards are never held back.
 */
function useWorkspaceArchived(workspaceId: string) {
  const { error } = useQuery({
    queryKey: workspaceStatusQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    retry: (count, error) => !isWorkspaceArchivedError(error) && count < 2,
    staleTime: 5 * 60 * 1000,
  });
  return isWorkspaceArchivedError(error);
}

export default useWorkspaceArchived;
