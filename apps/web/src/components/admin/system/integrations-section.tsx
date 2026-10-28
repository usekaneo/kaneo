import { PlugIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { StatusBadge } from "@/components/settings/status-badge";
import type {
  AdminSystemStatus,
  ServiceStatus,
} from "@/fetchers/admin/system-types";
import { ServiceStatusBadge } from "./service-status-badge";
import { SystemStatusRow } from "./system-status-row";

const INSTANCE_SETUP = {
  ok: "settings:adminSystem.integrations.instanceSetup.ok",
  warning: "settings:adminSystem.integrations.instanceSetup.warning",
  not_configured:
    "settings:adminSystem.integrations.instanceSetup.not_configured",
  down: "settings:adminSystem.integrations.instanceSetup.down",
} as const satisfies Record<ServiceStatus, string>;

type IntegrationsSectionProps = {
  integrations: AdminSystemStatus["integrations"];
};

export function IntegrationsSection({
  integrations,
}: IntegrationsSectionProps) {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t("settings:adminSystem.integrations.title")}>
      <SettingsCard>
        {integrations.map((integration) => {
          const usage =
            integration.connectedProjects === null
              ? t("settings:adminSystem.integrations.connectedUnknown")
              : t("settings:adminSystem.integrations.connectedProjects", {
                  count: integration.connectedProjects,
                });
          const setup = integration.requiresInstanceSetup
            ? t(INSTANCE_SETUP[integration.status])
            : null;

          return (
            <SystemStatusRow
              key={integration.type}
              icon={<PlugIcon />}
              title={integration.name}
              description={setup ? `${usage} · ${setup}` : usage}
              status={
                integration.requiresInstanceSetup ? (
                  <ServiceStatusBadge
                    status={integration.status}
                    variant="setup"
                  />
                ) : (
                  <StatusBadge tone="success">
                    {t("settings:adminSystem.integrations.available")}
                  </StatusBadge>
                )
              }
            />
          );
        })}
      </SettingsCard>
    </SettingsSection>
  );
}
