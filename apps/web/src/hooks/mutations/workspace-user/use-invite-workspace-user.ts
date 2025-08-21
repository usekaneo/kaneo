import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";

type InviteWorkspaceUserRequest = {
  workspaceId: string;
  email: string;
  role: "admin" | "member" | "owner";
  resend?: boolean;
};

function useInviteWorkspaceUser() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      email,
      role,
      resend,
    }: InviteWorkspaceUserRequest) => {
      const { data, error } = await authClient.organization.inviteMember({
        email,
        role,
        organizationId: workspaceId,
        resend,
      });

      if (error) {
        throw new Error(error.message || "Failed to invite workspace member");
      }

      return data;
    },
  });
}

export default useInviteWorkspaceUser;
