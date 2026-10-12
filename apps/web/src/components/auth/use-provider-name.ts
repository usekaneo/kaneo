import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { AuthProvider } from "./auth-methods";

export function useProviderName(customName: string | null | undefined) {
  const { t } = useTranslation();

  return useCallback(
    (provider: AuthProvider) => {
      if (provider === "google") return t("auth:providers.google");
      if (provider === "github") return t("auth:providers.github");
      if (provider === "discord") return t("auth:providers.discord");
      return customName || t("auth:providers.sso");
    },
    [customName, t],
  );
}
