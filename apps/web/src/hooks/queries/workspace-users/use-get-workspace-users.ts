import getActiveWorkspaceUsers from "@/fetchers/workspace-user/get-workspace-users";
import { useQuery } from "@tanstack/react-query";

function useGetWorkspaceUsers({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryKey: ["workspace-users", workspaceId],
    queryFn: () => getActiveWorkspaceUsers({ param: { workspaceId } }),
  });
}

export default useGetWorkspaceUsers;
