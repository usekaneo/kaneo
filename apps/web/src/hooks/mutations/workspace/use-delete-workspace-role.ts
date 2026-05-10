import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type DeleteWorkspaceRoleRequest = {
  workspaceId: string;
  roleName: string;
};

function useDeleteWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      workspaceId,
      roleName,
    }: DeleteWorkspaceRoleRequest) => {
      const { data, error } = await authClient.organization.deleteRole({
        organizationId: workspaceId,
        roleName,
      });
      if (error) {
        throw new Error(error.message || "Failed to delete role");
      }
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workspace-roles", variables.workspaceId],
      });
    },
  });
}

export default useDeleteWorkspaceRole;
