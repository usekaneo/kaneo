import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.deleteUser();

      if (error) {
        throw new Error(error.message || "Failed to delete account");
      }
    },
  });
}

export default useDeleteAccount;
