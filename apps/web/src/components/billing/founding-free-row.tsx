import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";

export function FoundingFreeRow() {
  const { t } = useTranslation();

  return (
    <SettingsRow
      icon={<Sparkles />}
      title={t("settings:billing.foundingFree.title")}
      badge={
        <StatusBadge tone="success">
          {t("settings:billing.foundingFree.badge")}
        </StatusBadge>
      }
      description={t("settings:billing.foundingFree.description")}
    />
  );
}
