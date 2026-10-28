import { useState } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";

export function useLinkGithubAccount() {
  const { t } = useTranslation();
  const [linking, setLinking] = useState(false);

  const link = async () => {
    setLinking(true);
    try {
      const result = await authClient.linkSocial({
        provider: "github",
        callbackURL: window.location.href,
      });
      if (result.error) throw new Error(result.error.message);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.updateError"),
      );
    } finally {
      setLinking(false);
    }
  };

  return { link, linking };
}
