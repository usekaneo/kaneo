import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type RejectInvitationRequest = {
  invitationId: string;
};

function useRejectInvitation() {
  return useMutation({
    mutationFn: async ({ invitationId }: RejectInvitationRequest) => {
      const { data, error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message || "Failed to reject invitation");
      }

      return data;
    },
  });
}

export default useRejectInvitation;
