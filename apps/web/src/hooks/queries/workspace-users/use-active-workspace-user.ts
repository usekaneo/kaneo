import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { authClient } from "@/lib/auth-client";

export const useGetActiveWorkspaceUser = () => {
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();

  return useQuery({
    queryKey: ["workspace-user", "active", workspace?.id, user?.id],
    enabled: !!workspace?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await authClient.organization.listMembers({
        query: {
          organizationId: workspace?.id,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to get active workspace user");
      }

      return data.members.find((member) => member.userId === user?.id) ?? null;
    },
  });
};
