import { useTranslation } from "react-i18next";

const PLATFORM_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string> }).env
      ?.VITE_APP_URL) ||
  "https://app.elsetasks.com";

export function ElseTasksBranding() {
  const { t } = useTranslation();

  return (
    <a
      href={PLATFORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-foreground transition-colors"
    >
      {t("publicProject:branding.poweredBy")}{" "}
      <span className="font-medium">{t("common:appName")}</span>
    </a>
  );
}

/** @deprecated Use ElseTasksBranding */
export const KaneoBranding = ElseTasksBranding;
