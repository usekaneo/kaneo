import {
  ActivityIcon,
  DatabaseIcon,
  HardDriveIcon,
  LayersIcon,
  RadioIcon,
  TagIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import type { AdminSystemStatus } from "@/fetchers/admin/system-types";
import { formatUptime } from "./format-uptime";
import { ServiceStatusBadge } from "./service-status-badge";
import { SystemStatusRow } from "./system-status-row";
import { useInstanceDescriptions } from "./use-instance-descriptions";

type InstanceSectionProps = {
  system: AdminSystemStatus;
};

export function InstanceSection({ system }: InstanceSectionProps) {
  const { t } = useTranslation();
  const descriptions = useInstanceDescriptions(system);

  return (
    <SettingsSection
      title={t("settings:adminSystem.instance.title")}
      description={t("settings:adminSystem.instance.description")}
    >
      <SettingsCard>
        <SystemStatusRow
          icon={<TagIcon />}
          title={t("settings:adminSystem.instance.version")}
          description={t("settings:adminSystem.instance.versionDescription")}
          status={
            <StatusBadge tone="neutral">
              {system.version
                ? `v${system.version}`
                : t("settings:adminSystem.instance.versionUnknown")}
            </StatusBadge>
          }
        />
        <SystemStatusRow
          icon={<ActivityIcon />}
          title={t("settings:adminSystem.instance.api")}
          description={t("settings:adminSystem.instance.apiDescription", {
            uptime: formatUptime(system.api.uptimeSeconds),
            node: system.api.nodeVersion,
          })}
          status={<ServiceStatusBadge status={system.api.status} />}
        />
        <SystemStatusRow
          icon={<DatabaseIcon />}
          title={t("settings:adminSystem.instance.database")}
          description={descriptions.databaseDescription}
          status={<ServiceStatusBadge status={system.database.status} />}
        />
        <SystemStatusRow
          icon={<RadioIcon />}
          title={t("settings:adminSystem.instance.realtime")}
          description={descriptions.realtimeDescription}
          status={<ServiceStatusBadge status={system.realtime.status} />}
        />
        <SystemStatusRow
          icon={<LayersIcon />}
          title={t("settings:adminSystem.instance.redis")}
          description={descriptions.redisDescription}
          status={<ServiceStatusBadge status={system.redis.status} />}
        />
        <SystemStatusRow
          icon={<HardDriveIcon />}
          title={t("settings:adminSystem.instance.storage")}
          description={descriptions.storageDescription}
          status={<ServiceStatusBadge status={system.storage.status} />}
        />
      </SettingsCard>
    </SettingsSection>
  );
}
