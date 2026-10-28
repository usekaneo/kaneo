import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { AgentAutomationListItem } from "@/types/agent-automation";
import { AutomationEnabledSwitch } from "./automation-enabled-switch";
import { AutomationTriggerIcon } from "./automation-trigger-icon";
import { AutomationStatusLabel } from "./automation-status-label";
import { getAutomationStatus } from "./get-automation-status";

type AutomationHomeRowProps = {
  workspaceId: string;
  automation: AgentAutomationListItem;
  isOwner: boolean;
  triggerLabel: string;
};

export function AutomationHomeRow({
  workspaceId,
  automation,
  isOwner,
  triggerLabel,
}: AutomationHomeRowProps) {
  const { t } = useTranslation();
  const status = getAutomationStatus(automation);
  const pending =
    automation.lastRun?.status === "awaiting_review"
      ? automation.lastRun.pendingProposals
      : 0;

  return (
    <li className="relative flex items-center gap-3 border-border/60 border-b py-2.5 last:border-b-0">
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <Link
          to="/dashboard/workspace/$workspaceId/agent/automations/$automationId"
          params={{ workspaceId, automationId: automation.id }}
          className="truncate text-foreground text-sm outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
        >
          {automation.name}
        </Link>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <AutomationTriggerIcon
            trigger={automation.trigger}
            className="size-3 shrink-0"
          />
          <span className="truncate">
            {triggerLabel} ·{" "}
            {t(`agent:automations.output.${automation.output}`)}
          </span>
          {status ? (
            <AutomationStatusLabel status={status} className="shrink-0" />
          ) : pending > 0 ? (
            <span className="shrink-0 text-info-foreground">
              {t("agent:automations.toReview", { count: pending })}
            </span>
          ) : null}
        </span>
      </div>
      {isOwner && (
        <AutomationEnabledSwitch
          workspaceId={workspaceId}
          automation={automation}
          className="relative z-10"
        />
      )}
    </li>
  );
}
