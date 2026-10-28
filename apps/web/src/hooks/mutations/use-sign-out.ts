import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getIdToken } from "@/fetchers/oauth/get-id-token";
import { descriptionSaveQueue } from "@/lib/description-save-queue";
import { i18n } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { signOutState } from "@/lib/sign-out-state";

function useSignOut(idpLogoutUrl?: string | null) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  return useMutation({
    mutationFn: async () => {
      const resume = descriptionSaveQueue.pause(session?.user.id ?? "");
      try {
        if (!(await descriptionSaveQueue.drain(session?.user.id ?? "")))
          throw new Error(i18n.t("tasks:detail.editor.saveFailed"));
        const url = idpLogoutUrl ? new URL(idpLogoutUrl) : null;
        if (url) {
          url.searchParams.set(
            "post_logout_redirect_uri",
            `${window.location.origin}/auth/sign-in`,
          );
          signOutState.isRedirecting = true;
          try {
            const { idToken } = await getIdToken();
            if (idToken) url.searchParams.set("id_token_hint", idToken);
          } catch {
            // If we can't get the id_token, proceed without it.
          }
        }

        const result = await authClient.signOut();
        if (result.error) {
          throw new Error(result.error.message);
        }
        descriptionSaveQueue.clear();
        if (url) {
          window.location.href = url.toString();
        } else {
          await navigate({ to: "/auth/sign-in" });
        }
        return result.data;
      } catch (error) {
        signOutState.isRedirecting = false;
        throw error;
      } finally {
        resume();
      }
    },
  });
}

export default useSignOut;
