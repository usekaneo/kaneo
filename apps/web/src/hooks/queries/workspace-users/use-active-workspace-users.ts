import getActiveWorkspaceUsers, {
  type GetActiveWorkspaceUsersRequest,
} from "@/fetchers/workspace-user/get-active-workspace-users";
import { useQuery } from "@tanstack/react-query";

export const useGetActiveWorkspaceUsers = ({
  workspaceId,
}: GetActiveWorkspaceUsersRequest) => {
  return useQuery({
    queryKey: ["workspace-users", "active", workspaceId],
    queryFn: () => getActiveWorkspaceUsers({ workspaceId }),
    enabled: !!workspaceId,
  });
};

export default useGetActiveWorkspaceUsers;
