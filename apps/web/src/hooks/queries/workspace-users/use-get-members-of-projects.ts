import { useQueries } from "@tanstack/react-query";
import getProjectMembers from "@/fetchers/workspace-user/get-project-members";
import { intersectById } from "@/lib/intersect-by-id";

function useGetMembersOfProjects({
  workspaceId,
  projectIds,
}: {
  workspaceId: string;
  projectIds: readonly string[];
}) {
  const ids = [...new Set(projectIds.filter(Boolean))];
  return useQueries({
    queries: ids.map((projectId) => ({
      queryKey: ["workspace-users", workspaceId, "project", projectId],
      queryFn: () => getProjectMembers({ workspaceId, projectId }),
      enabled: !!workspaceId,
    })),
    combine: (results) => {
      const lists = results.map((result) => result.data);
      return {
        data:
          ids.length > 0 && lists.every((list) => list !== undefined)
            ? intersectById(lists as NonNullable<(typeof lists)[number]>[])
            : undefined,
        isLoading: results.some((result) => result.isLoading),
      };
    },
  });
}

export default useGetMembersOfProjects;
