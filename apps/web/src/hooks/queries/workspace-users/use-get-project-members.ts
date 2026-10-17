import { useQuery } from "@tanstack/react-query";
import getProjectMembers from "@/fetchers/workspace-user/get-project-members";

function useGetProjectMembers({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  return useQuery({
    queryKey: ["workspace-users", workspaceId, "project", projectId],
    queryFn: () => getProjectMembers({ workspaceId, projectId }),
    enabled: !!workspaceId && !!projectId,
  });
}

export default useGetProjectMembers;
