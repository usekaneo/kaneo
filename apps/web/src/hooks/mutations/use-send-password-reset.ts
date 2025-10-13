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
      });

      if (error) {
        throw new Error(error.message || "Failed to change password");
      }

      return data;
    },
  });
}

export default useChangePassword;
