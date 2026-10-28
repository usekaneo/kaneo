import { useTranslation } from "react-i18next";

export function AuthDivider() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 py-6">
      <div className="h-px grow bg-border" />
      <span className="text-muted-foreground text-xs">
        {t("auth:forms.or")}
      </span>
      <div className="h-px grow bg-border" />
    </div>
  );
}
