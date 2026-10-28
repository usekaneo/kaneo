import { useState } from "react";
import { useTranslation } from "react-i18next";
import useCancelAgentRun from "@/hooks/mutations/agent/use-cancel-agent-run";
import useSendAgentPrompt from "@/hooks/mutations/agent/use-send-agent-prompt";
import useAgentConversationRuns from "@/hooks/queries/agent/use-agent-conversation-runs";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import { isAgentRunActive } from "@/lib/agent-run-status";
import { toast } from "@/lib/toast";
import { AgentComposer } from "./agent-composer";
import { AgentModelPicker } from "./agent-model-picker";
import { AgentThread } from "./agent-thread";
import { AgentUnavailable } from "./agent-unavailable";
import { getAgentErrorKey } from "./get-agent-error-key";
import { useAgentAttachments } from "./use-agent-attachments";

type AgentConversationViewProps = {
  workspaceId: string;
  conversationId: string;
  enabled: boolean;
};

export function AgentConversationView({
  workspaceId,
  conversationId,
  enabled,
}: AgentConversationViewProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const attachments = useAgentAttachments(workspaceId);
  const runs = useAgentConversationRuns(workspaceId, conversationId);
  const latestId = runs.data?.at(-1)?.id;
  const { data: latestRun } = useAgentRun(workspaceId, latestId);
  const running = latestRun ? isAgentRunActive(latestRun.status) : false;
  const send = useSendAgentPrompt(workspaceId);
  const cancel = useCancelAgentRun(workspaceId);

  const handleSubmit = async (prompt: string) => {
    try {
      await send.mutateAsync({
        conversationId,
        prompt,
        attachments: attachments.toRunInput(),
      });
      setDraft("");
      attachments.clear();
    } catch (error) {
      toast.error(t(getAgentErrorKey(error)));
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      <AgentThread
        workspaceId={workspaceId}
        runs={runs.data ?? []}
        isLoading={runs.isPending}
        isError={runs.isError}
      />
      <div className="shrink-0 px-4 pb-4">
        {enabled ? (
          <AgentComposer
            value={draft}
            onValueChange={setDraft}
            attachments={attachments}
            onSubmit={(prompt) => void handleSubmit(prompt)}
            onStop={() =>
              latestId &&
              cancel.mutate(latestId, {
                onError: (error) => toast.error(t(getAgentErrorKey(error))),
              })
            }
            placeholder={t("agent:composer.followUp")}
            running={running}
            sending={send.isPending}
            modelPicker={<AgentModelPicker workspaceId={workspaceId} />}
          />
        ) : (
          <AgentUnavailable />
        )}
      </div>
    </div>
  );
}
