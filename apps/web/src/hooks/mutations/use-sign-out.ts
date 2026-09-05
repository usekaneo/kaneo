import { resolveApiBaseUrl } from "@kaneo/libs";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

function useSignOut(idpLogoutUrl?: string | null) {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      if (idpLogoutUrl) {
        window.location.href = `${resolveApiBaseUrl(
          import.meta.env.VITE_API_URL,
        )}/oauth/logout`;
        return null;
      }

      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => navigate({ to: "/auth/sign-in" }),
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
