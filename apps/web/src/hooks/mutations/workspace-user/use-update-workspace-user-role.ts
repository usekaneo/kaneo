import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type UpdateWorkspaceUserRoleRequest = {
  workspaceId: string;
  memberId: string;
  role: string;
};

function useUpdateWorkspaceUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      memberId,
      role,
    }: UpdateWorkspaceUserRoleRequest) => {
      const { data, error } = await authClient.organization.updateMemberRole({
        memberId,
        organizationId: workspaceId,
        role: role as "admin" | "member" | "owner",
      });

      if (error) {
        throw new Error(
          error.message || "Failed to update workspace member role",
        );
      }

      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace", variables.workspaceId],
      });
      queryClient.invalidateQueries({ queryKey: ["full-workspace"] });
      queryClient.invalidateQueries({ queryKey: ["active-workspace-user"] });
    },
  });
}

export default useUpdateWorkspaceUserRole;
