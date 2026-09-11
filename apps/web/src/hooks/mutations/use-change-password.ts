import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

function useChangePassword() {
  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: ChangePasswordRequest) => {
      const { data, error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        // Sign out the account's other sessions on a password change; better-auth
        // keeps the current session, so the user stays signed in on this device.
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message || "Failed to change password");
      }

      return data;
    },
  });
}

export default useChangePassword;
