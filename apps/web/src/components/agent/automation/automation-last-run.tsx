import { useTranslation } from "react-i18next";
import { formatDateShort, formatDateTime } from "@/lib/format";
import type { AgentAutomationListItem } from "@/types/agent-automation";
import { AgentRunStatusIcon } from "../agent-run-status-icon";

export function AutomationLastRun({
  lastRun,
}: {
  lastRun: AgentAutomationListItem["lastRun"];
}) {
  const { t } = useTranslation();
  if (!lastRun) return <span className="text-muted-foreground">—</span>;

  const toReview =
    lastRun.status === "awaiting_review" && lastRun.pendingProposals > 0;
  const date = formatDateShort(lastRun.createdAt);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        <AgentRunStatusIcon status={lastRun.status} />
      </span>
      <time
        dateTime={lastRun.createdAt}
        title={formatDateTime(lastRun.createdAt)}
        className={
          toReview
            ? "truncate text-info-foreground"
            : lastRun.status === "failed"
              ? "truncate text-destructive-foreground"
              : "truncate text-foreground"
        }
      >
        {toReview
          ? t("agent:automations.toReview", {
              count: lastRun.pendingProposals,
            })
          : lastRun.status === "failed"
            ? t("agent:automations.failedOn", { date })
            : date}
      </time>
    </span>
  );
}
