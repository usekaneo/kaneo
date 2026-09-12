import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { authClient } from "@/lib/auth-client";

// `workspaceId` overrides the active workspace for views that mix workspaces.
export const useGetActiveWorkspaceUser = (workspaceId?: string) => {
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();
  const targetWorkspaceId = workspaceId ?? workspace?.id;

  return useQuery({
    queryKey: ["workspace-user", "active", targetWorkspaceId, user?.id],
    enabled: !!targetWorkspaceId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: targetWorkspaceId,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get active workspace user");
      }

      return data.members.find((member) => member.userId === user?.id) ?? null;
    },
  });
};
