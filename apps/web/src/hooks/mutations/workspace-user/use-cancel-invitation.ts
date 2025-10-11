import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type CancelInvitationRequest = {
  invitationId: string;
};

function useCancelInvitation() {
  return useMutation({
    mutationFn: async ({ invitationId }: CancelInvitationRequest) => {
      const { data, error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        throw new Error(error.message || "Failed to cancel invitation");
      }

      return data;
    },
  });
}

export default useCancelInvitation;
