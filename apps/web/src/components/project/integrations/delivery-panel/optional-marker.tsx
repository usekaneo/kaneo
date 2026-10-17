import { useTranslation } from "react-i18next";

export function OptionalMarker() {
  const { t } = useTranslation();

  return (
    <span className="text-xs font-normal text-muted-foreground">
      {t("settings:chatIntegrations.optional")}
    </span>
  );
}
