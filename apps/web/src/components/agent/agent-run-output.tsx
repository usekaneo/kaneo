import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import { isAgentRunActive } from "@/lib/agent-run-status";
import type { AgentRun, AgentRunStatus } from "@/types/agent";
import { AgentCodeJobCard } from "./code/agent-code-job-card";
import { AgentProposalReview } from "./agent-proposal-review";
import { AgentRunSteps } from "./agent-run-steps";
import { getAgentRunErrorKey } from "./get-agent-run-error-key";

type AgentRunOutputProps = {
  workspaceId: string;
  // Details once loaded; the summary values cover the first paint.
  run: AgentRun | undefined;
  status: AgentRunStatus;
  response: string;
  error: string | null;
  loadFailed?: boolean;
  getTaskKey?: (taskId: string) => string | undefined;
  readOnly?: boolean;
};

// What a run produced: tool steps, the answer, failures, proposals, and
// coding jobs.
export function AgentRunOutput({
  workspaceId,
  run,
  status,
  response,
  error,
  loadFailed,
  getTaskKey,
  readOnly,
}: AgentRunOutputProps) {
  const { t } = useTranslation();
  const active = isAgentRunActive(status);
  const errorKey = getAgentRunErrorKey(error);

  return (
    <>
      <AgentRunSteps steps={run?.steps ?? []} active={active} />

      {response &&
        (active ? (
          // Streaming text stays plain; the editor-backed renderer only
          // mounts once the response is final.
          <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
            {response}
          </p>
        ) : (
          <div className="text-sm">
            <MarkdownRenderer content={response} />
          </div>
        ))}

      {status === "failed" && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive-foreground text-xs"
        >
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          {errorKey ? t(errorKey) : (error ?? t("agent:errors.generic"))}
        </p>
      )}
      {status === "cancelled" && (
        <p className="text-muted-foreground text-xs">
          {t("agent:run.cancelled")}
        </p>
      )}
      {loadFailed && !run && (
        <p role="alert" className="text-destructive-foreground text-xs">
          {t("agent:run.loadError")}
        </p>
      )}

      {run && (
        <AgentProposalReview
          workspaceId={workspaceId}
          run={run}
          getTaskKey={getTaskKey}
          readOnly={readOnly}
        />
      )}
      {run?.jobs.map((job) => (
        <AgentCodeJobCard
          key={job.id}
          workspaceId={workspaceId}
          job={job}
          readOnly={readOnly}
        />
      ))}
    </>
  );
}
