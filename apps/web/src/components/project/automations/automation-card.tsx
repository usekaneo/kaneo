import { useTranslation } from "react-i18next";
import { AutomationRuleRow } from "@/components/project/automations/automation-rule-row";
import type { RepositoryConnection } from "@/components/project/automations/use-repository-connections";
import {
  WORKFLOW_EVENTS,
  type WorkflowEvent,
} from "@/components/project/automations/workflow-events";
import type { ProjectColumn } from "@/components/project/columns/types";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { cn } from "@/lib/cn";

type AutomationCardProps = {
  connection: RepositoryConnection;
  columns: ProjectColumn[];
  rules: Array<{ eventType: string; columnId: string }>;
  canEdit: boolean;
  onChange: (event: WorkflowEvent, columnId: string | null) => Promise<void>;
};

export function AutomationCard({
  connection,
  columns,
  rules,
  canEdit,
  onChange,
}: AutomationCardProps) {
  const { t } = useTranslation();
  const connected = connection.status.state === "connected";

  return (
    <SettingsCard>
      <SettingsRow
        icon={
          <connection.icon
            aria-hidden="true"
            className={cn("size-4", connection.iconClassName)}
          />
        }
        title={connection.name}
        badge={
          <StatusBadge tone={connected ? "success" : "warning"}>
            {connected
              ? t("settings:projectIntegrations.statusConnected")
              : t("settings:projectIntegrations.statusPaused")}
          </StatusBadge>
        }
        description={
          connection.status.detail ? (
            <span className="font-mono">{connection.status.detail}</span>
          ) : undefined
        }
      />
      {WORKFLOW_EVENTS.map((event) => (
        <AutomationRuleRow
          key={event}
          event={event}
          columns={columns}
          columnId={rules.find((rule) => rule.eventType === event)?.columnId}
          canEdit={canEdit}
          onChange={(columnId) => onChange(event, columnId)}
        />
      ))}
    </SettingsCard>
  );
}
