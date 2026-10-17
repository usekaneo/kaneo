import { useQuery } from "@tanstack/react-query";
import getMyProjectAccess from "@/fetchers/workspace-user/get-my-project-access";

function useGetMyProjectAccess(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["workspace-users", workspaceId, "project-access", "me"],
    queryFn: () => getMyProjectAccess(workspaceId),
    enabled: enabled && !!workspaceId,
    refetchOnMount: "always",
  });
}

export default useGetMyProjectAccess;
