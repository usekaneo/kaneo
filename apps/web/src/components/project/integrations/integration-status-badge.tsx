import { useTranslation } from "react-i18next";
import type { IntegrationState } from "@/components/project/integrations/get-integration-status";
import { cn } from "@/lib/cn";

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

  const connected = state === "connected";

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium",
        connected
          ? "bg-success/10 text-success-foreground"
          : "bg-warning/10 text-warning-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          connected ? "bg-success" : "bg-warning",
        )}
      />
      {connected
        ? t("settings:projectIntegrations.statusConnected")
        : t("settings:projectIntegrations.statusPaused")}
    </span>
  );
}
