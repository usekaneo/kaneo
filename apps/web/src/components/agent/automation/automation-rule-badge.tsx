import { useTranslation } from "react-i18next";

export function AutomationRuleBadge() {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 rounded-sm bg-muted px-1.5 py-px font-medium text-[11px] text-muted-foreground">
      {t("agent:automations.rule.badge")}
    </span>
  );
}
