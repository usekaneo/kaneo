import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

function useSignOut() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            navigate({ to: "/auth/sign-in" });
          },
        },
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
}

export default useSignOut;
