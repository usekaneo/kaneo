import { useTranslation } from "react-i18next";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { RecentAgentRun } from "@/types/agent";
import { AgentRunStatusIcon } from "./agent-run-status-icon";

type AgentRecentRunRowProps = {
  run: RecentAgentRun;
  onOpen: () => void;
};

export function AgentRecentRunRow({ run, onOpen }: AgentRecentRunRowProps) {
  const { t } = useTranslation();
  const detail =
    run.status === "awaiting_review" && run.pendingProposals > 0 ? (
      <span className="rounded-md bg-info/10 px-2 py-0.5 font-medium text-info-foreground text-xs">
        {t("agent:recent.toReview", { count: run.pendingProposals })}
      </span>
    ) : run.status === "completed" && run.appliedProposals > 0 ? (
      t("agent:recent.applied", { count: run.appliedProposals })
    ) : (
      t(`agent:recent.status.${run.status}`)
    );

  return (
    <li className="border-border/60 border-b last:border-b-0">
      <button
        type="button"
        className="flex h-12 w-full items-center gap-3 text-left transition-colors hover:bg-muted/40"
        onClick={onOpen}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          <AgentRunStatusIcon status={run.status} />
        </span>
        <span className="min-w-0 grow truncate text-foreground text-sm">
          {run.prompt}
        </span>
        <span className="hidden w-40 shrink-0 text-muted-foreground text-xs sm:flex">
          {detail}
        </span>
        <time
          dateTime={run.createdAt}
          title={formatDateTime(run.createdAt)}
          className="w-20 shrink-0 text-right text-muted-foreground text-xs"
        >
          {formatRelativeTime(run.createdAt)}
        </time>
      </button>
    </li>
  );
}
