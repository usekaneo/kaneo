import { Building2, FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAgentConfig from "@/hooks/queries/agent/use-agent-config";
import type { Automation } from "@/types/agent-automation";
import { AgentModelLogo } from "../agent-model-logo";
import { AgentOwnerAvatar } from "../agent-owner-avatar";
import { AgentSharedIndicator } from "../agent-shared-indicator";
import { AUTOMATION_OUTPUT_ICONS } from "./automation-icons";
import { AutomationTriggerIcon } from "./automation-trigger-icon";
import { useAutomationTriggerLabel } from "./use-automation-trigger-label";

// One line of settings under the automation's name.
export function AutomationMeta({
  workspaceId,
  automation,
}: {
  workspaceId: string;
  automation: Automation;
}) {
  const { t } = useTranslation();
  const { data: config } = useAgentConfig(workspaceId);
  const triggerLabel = useAutomationTriggerLabel(workspaceId);
  const OutputIcon = AUTOMATION_OUTPUT_ICONS[automation.output];
  const ScopeIcon = automation.project ? FolderKanban : Building2;
  const model =
    config?.models.find((item) => item.id === automation.model)?.label ??
    automation.model;

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground text-sm [&_svg]:size-3.5 [&_svg]:shrink-0">
      <li className="flex min-w-0 items-center gap-1.5">
        <AutomationTriggerIcon trigger={automation.trigger} />
        <span className="truncate">{triggerLabel(automation.trigger)}</span>
      </li>
      <li className="flex items-center gap-1.5">
        <ScopeIcon aria-hidden="true" />
        {automation.project?.name ?? t("agent:automations.scope.workspace")}
      </li>
      <li className="flex items-center gap-1.5">
        <OutputIcon aria-hidden="true" />
        {t(`agent:automations.output.${automation.output}Long`)}
      </li>
      <li className="flex items-center gap-1.5">
        <AgentModelLogo modelId={automation.model} />
        {model}
      </li>
      <li className="flex items-center gap-1.5">
        <AgentOwnerAvatar owner={automation.owner} />
        {t("agent:automations.runsAsName", { name: automation.owner.name })}
      </li>
      {automation.sharedAt && (
        <li className="flex items-center">
          <AgentSharedIndicator />
        </li>
      )}
    </ul>
  );
}
