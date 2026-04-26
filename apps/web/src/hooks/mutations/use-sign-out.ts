import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getIdToken } from "@/fetchers/oauth/get-id-token";
import { authClient } from "@/lib/auth-client";

function useSignOut(idpLogoutUrl?: string | null) {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => {
      let idToken: string | null = null;

      if (idpLogoutUrl) {
        try {
          const data = await getIdToken();
          idToken = data.idToken;
        } catch {
          // If we can't get the id_token, proceed without it
        }
      }

      const result = await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            if (idpLogoutUrl) {
              const redirectUri = `${window.location.origin}/auth/sign-in`;
              const url = new URL(idpLogoutUrl);
              url.searchParams.set("post_logout_redirect_uri", redirectUri);
              if (idToken) {
                url.searchParams.set("id_token_hint", idToken);
              }
              window.location.href = url.toString();
            } else {
              navigate({ to: "/auth/sign-in" });
            }
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
