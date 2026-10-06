import type { IntegrationStatus } from "@/components/project/integrations/get-integration-status";
import type {
  IntegrationDefinition,
  IntegrationId,
} from "@/components/project/integrations/integration-definitions";
import { IntegrationRow } from "@/components/project/integrations/integration-row";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

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
    <section className="space-y-3">
      <SettingsSectionHeader title={title} />
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {integrations.map((integration) => (
          <IntegrationRow
            key={integration.id}
            integration={integration}
            projectId={projectId}
            status={statuses[integration.id]}
            onRetry={() => onRetry(integration.id)}
          />
        ))}
      </div>
    </section>
  );
}
