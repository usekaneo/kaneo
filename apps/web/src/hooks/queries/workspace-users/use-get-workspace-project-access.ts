import { useQuery } from "@tanstack/react-query";
import getWorkspaceProjectAccess from "@/fetchers/workspace-user/get-workspace-project-access";

function useGetWorkspaceProjectAccess(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["workspace-users", workspaceId, "project-access"],
    queryFn: () => getWorkspaceProjectAccess(workspaceId),
    enabled: enabled && !!workspaceId,
    refetchOnMount: "always",
  });
}

export default useGetWorkspaceProjectAccess;
