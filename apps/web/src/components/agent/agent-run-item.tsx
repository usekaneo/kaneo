import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MarkdownRenderer } from "@/components/public-project/markdown-renderer";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import { isAgentRunActive } from "@/lib/agent-run-status";
import type { AgentRunSummary } from "@/types/agent";
import { AgentProposalReview } from "./agent-proposal-review";
import { AgentRunAttachments } from "./agent-run-attachments";
import { AgentRunSteps } from "./agent-run-steps";
import { getAgentRunErrorKey } from "./get-agent-run-error-key";
import { AgentPromptText } from "./mention/agent-prompt-text";

type AgentRunItemProps = {
  workspaceId: string;
  summary: AgentRunSummary;
  getTaskKey?: (taskId: string) => string | undefined;
};

export function AgentRunItem({
  workspaceId,
  summary,
  getTaskKey,
}: AgentRunItemProps) {
  const { t } = useTranslation();
  const { data: run, isError } = useAgentRun(workspaceId, summary.id);
  const status = run?.status ?? summary.status;
  const active = isAgentRunActive(status);
  const response = run?.response ?? summary.response;
  const error = run?.error ?? summary.error;
  const errorKey = getAgentRunErrorKey(error);

  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-col items-end gap-1.5">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-muted px-3 py-2.5 text-foreground text-sm">
          <AgentPromptText prompt={summary.prompt} />
        </p>
        <AgentRunAttachments
          workspaceId={workspaceId}
          attachments={summary.attachments}
        />
      </div>

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
      {isError && !run && (
        <p role="alert" className="text-destructive-foreground text-xs">
          {t("agent:run.loadError")}
        </p>
      )}

      {run && (
        <AgentProposalReview
          workspaceId={workspaceId}
          run={run}
          getTaskKey={getTaskKey}
        />
      )}
    </article>
  );
}
