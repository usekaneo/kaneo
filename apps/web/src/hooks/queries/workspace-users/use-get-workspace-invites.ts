import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type GetWorkspaceInvitesRequest = {
  workspaceId?: string;
};

function useGetWorkspaceInvites({ workspaceId }: GetWorkspaceInvitesRequest) {
  return useQuery({
    queryKey: ["workspace-invites", workspaceId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.listInvitations({
        query: {
          organizationId: workspaceId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get workspace invites");
      }

      return data;
    },
  });
}

export default useGetWorkspaceInvites;
