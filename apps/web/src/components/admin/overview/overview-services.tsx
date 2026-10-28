import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ServiceStatusBadge } from "@/components/admin/system/service-status-badge";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { AdminOverview } from "@/fetchers/admin/overview-types";

export function OverviewServices({
  services,
}: {
  services: AdminOverview["services"];
}) {
  const { t } = useTranslation();
  const rows = [
    [t("settings:adminSystem.instance.api"), services.api],
    [t("settings:adminSystem.instance.database"), services.database],
    [t("settings:adminSystem.instance.realtime"), services.realtime],
    [t("settings:adminSystem.instance.redis"), services.redis],
    [t("settings:adminSystem.email.title"), services.email],
    [t("settings:adminSystem.instance.storage"), services.storage],
  ] as const;
  return (
    <SettingsSection
      title={t("settings:adminOverview.services")}
      action={
        <Link
          to="/dashboard/settings/admin/system"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("settings:adminOverview.viewSystem")}
        </Link>
      }
    >
      <SettingsCard className="grid divide-y-0 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, status]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 bg-card px-4 py-3"
          >
            <span className="text-sm">{label}</span>
            <ServiceStatusBadge status={status} />
          </div>
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
