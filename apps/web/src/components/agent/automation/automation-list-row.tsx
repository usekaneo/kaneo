import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { AgentAutomationListItem } from "@/types/agent-automation";
import { AgentOwnerAvatar } from "../agent-owner-avatar";
import { AutomationEnabledSwitch } from "./automation-enabled-switch";
import { AUTOMATION_OUTPUT_ICONS } from "./automation-icons";
import { AutomationTriggerIcon } from "./automation-trigger-icon";
import { AutomationLastRun } from "./automation-last-run";
import { AutomationNextRun } from "./automation-next-run";
import {
  AUTOMATION_TABLE_CELL,
  AUTOMATION_TABLE_GRID,
} from "./automation-table-grid";

type AutomationListRowProps = {
  workspaceId: string;
  automation: AgentAutomationListItem;
  isOwner: boolean;
  triggerLabel: string;
};

export function AutomationListRow({
  workspaceId,
  automation,
  isOwner,
  triggerLabel,
}: AutomationListRowProps) {
  const { t } = useTranslation();
  const OutputIcon = AUTOMATION_OUTPUT_ICONS[automation.output];
  const inactive = !automation.enabled;

  return (
    <li
      className={cn(
        AUTOMATION_TABLE_GRID,
        "relative border-border/60 border-b py-3 transition-colors last:border-b-0 hover:bg-muted/30",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          to="/dashboard/workspace/$workspaceId/agent/automations/$automationId"
          params={{ workspaceId, automationId: automation.id }}
          className={cn(
            "truncate text-sm outline-none after:absolute after:inset-0 focus-visible:underline",
            inactive ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {automation.name}
        </Link>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <AutomationTriggerIcon
            trigger={automation.trigger}
            className="size-3 shrink-0"
          />
          <span className="truncate">{triggerLabel}</span>
        </span>
      </div>
      <span className={cn(AUTOMATION_TABLE_CELL, "text-foreground")}>
        <span className="truncate">
          {automation.project?.name ?? t("agent:automations.scope.workspace")}
        </span>
      </span>
      <span className={cn(AUTOMATION_TABLE_CELL, "gap-1.5 text-foreground")}>
        <OutputIcon
          aria-hidden="true"
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="truncate">
          {t(`agent:automations.output.${automation.output}`)}
        </span>
      </span>
      <span className={AUTOMATION_TABLE_CELL}>
        <AgentOwnerAvatar
          owner={automation.owner}
          label={t("agent:automations.ownedBy", {
            name: automation.owner.name,
          })}
        />
      </span>
      <span className={AUTOMATION_TABLE_CELL}>
        <AutomationLastRun lastRun={automation.lastRun} />
      </span>
      <span className={AUTOMATION_TABLE_CELL}>
        <AutomationNextRun automation={automation} />
      </span>
      <span className="relative z-10 flex justify-end">
        {isOwner && (
          <AutomationEnabledSwitch
            workspaceId={workspaceId}
            automation={automation}
          />
        )}
      </span>
    </li>
  );
}
