import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";

type DeleteWorkspaceUserRequest = {
  workspaceId: string;
  userId: string;
};

function useDeleteWorkspaceUser() {
  return useMutation({
    mutationFn: async ({ workspaceId, userId }: DeleteWorkspaceUserRequest) => {
      const { data, error } = await authClient.organization.removeMember({
        memberIdOrEmail: userId,
        organizationId: workspaceId,
      });

      if (error) {
        throw new Error(error.message || "Failed to remove workspace member");
      }

      return data;
    },
  });
}

export default useDeleteWorkspaceUser;
