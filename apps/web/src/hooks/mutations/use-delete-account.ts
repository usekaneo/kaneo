import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export const SESSION_TOO_OLD = "SESSION_TOO_OLD";

function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.deleteUser();

      if (error) {
        if (error.code === "SESSION_EXPIRED") {
          throw new Error(SESSION_TOO_OLD);
        }

        throw new Error(error.message || "Failed to delete account");
      }

      return data;
    },
  });
}

export default useDeleteAccount;
