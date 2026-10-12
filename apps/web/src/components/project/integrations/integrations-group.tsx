import type { IntegrationStatus } from "@/components/project/integrations/get-integration-status";
import type {
  IntegrationDefinition,
  IntegrationId,
} from "@/components/project/integrations/integration-definitions";
import { IntegrationRow } from "@/components/project/integrations/integration-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";

type IntegrationsGroupProps = {
  onRetry: (id: IntegrationId) => void;
  title: string;
  integrations: IntegrationDefinition[];
  projectId: string;
  statuses: Partial<Record<IntegrationId, IntegrationStatus>>;
};

export function IntegrationsGroup({
  title,
  onRetry,
  integrations,
  projectId,
  statuses,
}: IntegrationsGroupProps) {
  return (
    <SettingsSection title={title}>
      <SettingsCard>
        {integrations.map((integration) => (
          <IntegrationRow
            key={integration.id}
            integration={integration}
            projectId={projectId}
            status={statuses[integration.id]}
            onRetry={() => onRetry(integration.id)}
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
