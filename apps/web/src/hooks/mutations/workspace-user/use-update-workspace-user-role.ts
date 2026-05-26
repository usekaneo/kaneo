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
      // The members page reads from useGetFullWorkspace which keys by
      // ["workspace", "full", workspaceId] — invalidate that exact prefix
      // so the table re-renders with the new role.
      queryClient.invalidateQueries({
        queryKey: ["workspace", "full", variables.workspaceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspace-users", variables.workspaceId],
      });
      // useGetActiveWorkspaceUser is keyed ["workspace-user", "active", ...]
      // and drives sidebar/role badges for the current user.
      queryClient.invalidateQueries({
        queryKey: ["workspace-user", "active"],
      });
      // The active user's role may have changed; capability cache is keyed
      // by (workspaceId, role) so we drop the per-workspace cache.
      queryClient.invalidateQueries({
        queryKey: ["workspace-capabilities", variables.workspaceId],
      });
    },
  });
}

export default useUpdateWorkspaceUserRole;
