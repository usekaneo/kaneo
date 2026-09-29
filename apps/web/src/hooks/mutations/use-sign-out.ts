import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getIdToken } from "@/fetchers/oauth/get-id-token";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { i18n } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";

function useSignOut(idpLogoutUrl?: string | null) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  return useMutation({
    mutationFn: async () => {
      const resume = descriptionSaveQueue.pause(session?.user.id ?? "");
      try {
        if (!(await descriptionSaveQueue.drain(session?.user.id ?? "")))
          throw new Error(i18n.t("tasks:detail.editor.saveFailed"));
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
              descriptionSaveQueue.clear();
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
      } finally {
        resume();
      }
    },
  });
}

export default useSignOut;
