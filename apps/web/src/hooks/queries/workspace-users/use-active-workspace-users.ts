import getActiveWorkspaceUsers from "@/fetchers/workspace-user/get-active-workspace-users";
import { useQuery } from "@tanstack/react-query";

export const useActiveWorkspaceUsers = (workspaceId: string) => {
  return useQuery({
    queryKey: ["workspace-users", "active", workspaceId],
    queryFn: () => getActiveWorkspaceUsers(workspaceId),
    enabled: !!workspaceId,
  });
};

export default useActiveWorkspaceUsers;
