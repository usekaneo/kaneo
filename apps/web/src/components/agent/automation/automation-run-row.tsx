import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { AutomationRun } from "@/types/agent-automation";
import { AgentRunStatusIcon } from "../agent-run-status-icon";
import { describeAutomationRun } from "./describe-automation-run";
import { formatCost } from "./format-run-meta";

type AutomationRunRowProps = {
  run: AutomationRun;
  selected: boolean;
  onSelect: () => void;
};

export function AutomationRunRow({
  run,
  selected,
  onSelect,
}: AutomationRunRowProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  const cost = formatCost(run.costUsd, locale);
  const toReview = run.status === "awaiting_review" && run.pendingProposals > 0;
  const detail = toReview
    ? t("agent:automations.toReview", { count: run.pendingProposals })
    : run.appliedProposals > 0
      ? t("agent:recent.applied", { count: run.appliedProposals })
      : t(`agent:recent.status.${run.status}`);

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-muted",
        )}
      >
        <span className="flex h-5 w-3.5 shrink-0 items-center justify-center">
          <AgentRunStatusIcon status={run.status} />
        </span>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate text-foreground text-sm">
            {describeAutomationRun(run.trigger, t)}
          </span>
          <span
            className={cn(
              "truncate text-xs",
              toReview
                ? "text-info-foreground"
                : run.status === "failed"
                  ? "text-destructive-foreground"
                  : "text-muted-foreground",
            )}
          >
            {detail}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
          <time
            dateTime={run.createdAt}
            title={formatDateTime(run.createdAt)}
            className="text-muted-foreground"
          >
            {formatRelativeTime(run.createdAt)}
          </time>
          {cost && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {cost}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
