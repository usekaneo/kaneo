import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

function useDeleteAccount() {
  return useMutation({
    // `password` is optional: credential accounts pass it, while social/OIDC
    // accounts rely on a fresh session (better-auth decides server-side).
    mutationFn: async (password?: string) => {
      const result = await authClient.deleteUser(password ? { password } : {});
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useDeleteAccount;
