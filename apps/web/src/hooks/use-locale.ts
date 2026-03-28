import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth-client";
import { getBrowserLocale, resolveLocale } from "@/lib/i18n";

export function useLocale() {
  const { i18n } = useTranslation();

  const locale = useMemo(
    () => resolveLocale(i18n.resolvedLanguage, getBrowserLocale()),
    [i18n.resolvedLanguage],
  );

  const setLocale = async (nextLocale: string) => {
    const { error } = await authClient.updateUser({ locale: nextLocale });
    if (error) {
      throw new Error(error.message || "Failed to update locale");
    }

    await i18n.changeLanguage(resolveLocale(nextLocale, null));
  };

  return {
    locale,
    setLocale,
  };
}
