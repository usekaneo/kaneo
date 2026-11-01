import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import type { AgentRunSummary } from "@/types/agent";
import { AgentRunAttachments } from "./agent-run-attachments";
import { AgentRunOutput } from "./agent-run-output";
import { AgentPromptText } from "./mention/agent-prompt-text";

type AgentRunItemProps = {
  workspaceId: string;
  summary: AgentRunSummary;
  getTaskKey?: (taskId: string) => string | undefined;
  readOnly?: boolean;
};

export function AgentRunItem({
  workspaceId,
  summary,
  getTaskKey,
  readOnly,
}: AgentRunItemProps) {
  const { data: run, isError } = useAgentRun(workspaceId, summary.id);

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
      <AgentRunOutput
        workspaceId={workspaceId}
        run={run}
        status={run?.status ?? summary.status}
        response={run?.response ?? summary.response}
        error={run?.error ?? summary.error}
        loadFailed={isError}
        getTaskKey={getTaskKey}
        readOnly={readOnly}
      />
    </article>
  );
}
