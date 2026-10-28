import { Link } from "@tanstack/react-router";
import { ArrowRight, GitMerge } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { AutomationRuleListItem } from "@/types/agent-automation";
import { AutomationRuleBadge } from "./automation-rule-badge";
import {
  AUTOMATION_TABLE_CELL,
  AUTOMATION_TABLE_GRID,
} from "./automation-table-grid";
import { describeWorkflowRule } from "./describe-workflow-rule";

// Read-only here; the link opens the project's workflow settings.
export function AutomationRuleListRow({
  rule,
}: {
  rule: AutomationRuleListItem;
}) {
  const { t } = useTranslation();
  const { title, detail } = describeWorkflowRule(rule, t);

  return (
    <li
      className={cn(
        AUTOMATION_TABLE_GRID,
        "relative border-border/60 border-b py-3 transition-colors last:border-b-0 hover:bg-muted/30",
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            to="/dashboard/settings/projects/$projectId/workflow"
            params={{ projectId: rule.project.id }}
            className="truncate text-foreground text-sm outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {title}
          </Link>
          <AutomationRuleBadge />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <GitMerge aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">
            {detail}
            <span className="lg:hidden"> · {rule.project.name}</span>
          </span>
        </span>
      </div>
      <span className={cn(AUTOMATION_TABLE_CELL, "text-foreground")}>
        <span className="truncate">{rule.project.name}</span>
      </span>
      <span className={cn(AUTOMATION_TABLE_CELL, "gap-1.5 text-foreground")}>
        {rule.columnName && (
          <>
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="truncate">
              {t("agent:automations.rule.moveTo", { column: rule.columnName })}
            </span>
          </>
        )}
      </span>
      <span className={cn(AUTOMATION_TABLE_CELL, "text-muted-foreground")}>
        —
      </span>
      <span className={cn(AUTOMATION_TABLE_CELL, "text-muted-foreground")}>
        —
      </span>
      <span className={cn(AUTOMATION_TABLE_CELL, "text-muted-foreground")}>
        {t("agent:automations.onEvent")}
      </span>
      <span />
    </li>
  );
}
