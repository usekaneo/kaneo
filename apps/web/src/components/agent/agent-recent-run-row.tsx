import { Code } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isAgentRunActive } from "@/lib/agent-run-status";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { RecentAgentRun } from "@/types/agent";
import { AgentOwnerAvatar } from "./agent-owner-avatar";
import { AgentRunStatusIcon } from "./agent-run-status-icon";
import { AgentSharedIndicator } from "./agent-shared-indicator";
import { AgentCodeJobPill } from "./code/agent-code-job-pill";
import { getLatestCodeJob } from "./code/get-latest-code-job";
import { agentPromptToPlainText } from "./mention/agent-mention-token";

type AgentRecentRunRowProps = {
  run: RecentAgentRun;
  onOpen: () => void;
};

export function AgentRecentRunRow({ run, onOpen }: AgentRecentRunRowProps) {
  const { t } = useTranslation();
  const job = getLatestCodeJob(run.jobs);
  const toReview = run.status === "awaiting_review" && run.pendingProposals > 0;
  const showJob = job && !toReview && !isAgentRunActive(run.status);
  const detail = showJob ? (
    <AgentCodeJobPill job={job} />
  ) : toReview ? (
    <span className="rounded-md bg-info/10 px-2 py-0.5 font-medium text-info-foreground text-xs">
      {t("agent:recent.toReview", { count: run.pendingProposals })}
    </span>
  ) : run.status === "completed" && run.appliedProposals > 0 ? (
    t("agent:recent.applied", { count: run.appliedProposals })
  ) : (
    t(`agent:recent.status.${run.status}`)
  );

  return (
    <li>
      <button
        type="button"
        className="flex h-11 w-full items-center gap-3 rounded-lg px-2 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {showJob ? (
            <Code
              aria-hidden="true"
              className="size-3.5 text-muted-foreground"
            />
          ) : (
            <AgentRunStatusIcon status={run.status} />
          )}
        </span>
        <span className="flex min-w-0 grow items-center gap-1.5">
          <span className="truncate text-foreground text-sm">
            {agentPromptToPlainText(run.prompt)}
          </span>
          {run.shared && <AgentSharedIndicator />}
        </span>
        <span className="hidden w-40 shrink-0 text-muted-foreground text-xs sm:flex">
          {detail}
        </span>
        <AgentOwnerAvatar
          owner={run.owner}
          label={t("agent:sharing.startedBy", { name: run.owner.name })}
        />
        <time
          dateTime={run.createdAt}
          title={formatDateTime(run.createdAt)}
          className="min-w-20 shrink-0 whitespace-nowrap text-right text-muted-foreground text-xs"
        >
          {formatRelativeTime(run.createdAt)}
        </time>
      </button>
    </li>
  );
}
