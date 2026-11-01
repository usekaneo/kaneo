import { Link } from "@tanstack/react-router";
import { GitMerge } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AutomationRuleListItem } from "@/types/agent-automation";
import { AutomationRuleBadge } from "./automation-rule-badge";
import { describeWorkflowRule } from "./describe-workflow-rule";

export function AutomationHomeRuleRow({
  rule,
}: {
  rule: AutomationRuleListItem;
}) {
  const { t } = useTranslation();
  const { title, detail } = describeWorkflowRule(rule, t);

  return (
    <li className="relative flex items-center gap-3 border-border/60 border-b py-2.5 last:border-b-0">
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <Link
            to="/dashboard/settings/projects/$projectId/workflow"
            params={{ projectId: rule.project.id }}
            className="truncate text-foreground text-sm outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
          >
            {title}
          </Link>
          <AutomationRuleBadge />
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
          <GitMerge aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">
            {detail} · {rule.project.name}
          </span>
        </span>
      </div>
    </li>
  );
}
