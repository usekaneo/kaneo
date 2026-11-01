import { ArrowUpRight, CircleAlert, Loader2 } from "lucide-react";
import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import useAgentCodeJob from "@/hooks/queries/agent/use-agent-code-job";
import useAgentCodeJobEvents from "@/hooks/queries/agent/use-agent-code-job-events";
import {
  canCancelAgentCodeJob,
  isAgentCodeJobActive,
} from "@/lib/agent-code-job-status";
import type { AgentCodeJob } from "@/types/agent";
import { AgentCodeJobCancelButton } from "./agent-code-job-cancel-button";
import { AgentCodeJobPill } from "./agent-code-job-pill";
import { AgentCodeJobSteps } from "./agent-code-job-steps";
import { getCodeJobFailureKey } from "./get-code-job-failure-key";
import { getCodeJobLabel } from "./get-code-job-label";
import { getCodeJobPhaseKey } from "./get-code-job-phase-key";

type AgentCodeJobCardProps = {
  workspaceId: string;
  // The run's copy covers the first paint; the job query keeps it live.
  job: AgentCodeJob;
  readOnly?: boolean;
};

export function AgentCodeJobCard({
  workspaceId,
  job: initialJob,
  readOnly = false,
}: AgentCodeJobCardProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const { data: liveJob } = useAgentCodeJob(workspaceId, initialJob.id);
  const job = liveJob ?? initialJob;
  const { data: events = [], refetch: refetchEvents } = useAgentCodeJobEvents(
    workspaceId,
    job.id,
  );
  const active = isAgentCodeJobActive(job.status);
  const canCancel = !readOnly && canCancelAgentCodeJob(job.status);

  // Events have no polling of their own; refresh them on each state change.
  useEffect(() => {
    void refetchEvents();
  }, [job.status, refetchEvents]);

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs/5"
    >
      <header className="flex items-center justify-between gap-2 border-border/60 border-b bg-muted/30 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <GithubIcon className="size-3.5 shrink-0 text-foreground" />
          <h3
            id={headingId}
            className="truncate font-semibold text-[13px] text-foreground"
          >
            {job.repositoryOwner}/{job.repositoryName}
          </h3>
        </div>
        <AgentCodeJobPill job={job} linkPullRequest />
      </header>
      <div className="flex flex-col gap-2.5 p-3">
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {job.branch}
        </p>
        {active && (
          <p
            role="status"
            className="flex items-center gap-1.5 text-foreground text-xs"
          >
            <Loader2
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin"
            />
            {t(getCodeJobPhaseKey(job.phase) ?? getCodeJobLabel(job).key)}
          </p>
        )}
        {job.status === "failed" && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive-foreground text-xs"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-px size-3.5 shrink-0"
            />
            <span className="min-w-0">
              {t(getCodeJobFailureKey(job.error))}
              {job.error && (
                <code className="ml-1.5 font-mono text-[11px] opacity-80">
                  {job.error}
                </code>
              )}
            </span>
          </p>
        )}
        {job.status === "completed" && job.summary && (
          <p className="whitespace-pre-wrap break-words text-foreground text-xs leading-relaxed">
            {job.summary}
          </p>
        )}
        <AgentCodeJobSteps events={events} />
      </div>
      {(job.externalUrl || canCancel) && (
        <footer className="flex items-center justify-between gap-2 border-border/60 border-t px-3 py-2.5">
          {job.externalUrl ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
              render={
                <a
                  href={job.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              {t("agent:code.actionsRun")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Button>
          ) : (
            <span />
          )}
          {canCancel && (
            <AgentCodeJobCancelButton
              workspaceId={workspaceId}
              jobId={job.id}
            />
          )}
        </footer>
      )}
    </section>
  );
}
