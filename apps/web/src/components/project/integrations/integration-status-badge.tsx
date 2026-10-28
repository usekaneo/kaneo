import { useTranslation } from "react-i18next";
import type { IntegrationState } from "@/components/project/integrations/get-integration-status";
import { StatusBadge } from "@/components/settings/status-badge";

type IntegrationStatusBadgeProps = {
  state: IntegrationState;
};

export function IntegrationStatusBadge({ state }: IntegrationStatusBadgeProps) {
  const { t } = useTranslation();

  if (state === "disconnected" || state === "loading") return null;
  if (state === "unavailable") {
    return (
      <span className="text-xs text-muted-foreground" role="status">
        {t("common:error.title")}
      </span>
    );
  }

  return state === "connected" ? (
    <StatusBadge tone="success">
      {t("settings:projectIntegrations.statusConnected")}
    </StatusBadge>
  ) : (
    <StatusBadge tone="warning">
      {t("settings:projectIntegrations.statusPaused")}
    </StatusBadge>
  );
}
