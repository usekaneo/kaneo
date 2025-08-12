import { authClient } from "@/lib/auth-client";
import { useMutation } from "@tanstack/react-query";

function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useSignOut;
