import { FolderKanban, Plus, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useCancelAgentRun from "@/hooks/mutations/agent/use-cancel-agent-run";
import useSendAgentPrompt from "@/hooks/mutations/agent/use-send-agent-prompt";
import useAgentConversationRuns from "@/hooks/queries/agent/use-agent-conversation-runs";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import { isAgentRunActive } from "@/lib/agent-run-status";
import { toast } from "@/lib/toast";
import { useAgentPanelStore } from "@/store/agent-panel";
import { AgentComposer } from "./agent-composer";
import { AgentModelPicker } from "./agent-model-picker";
import { AgentHistoryMenu } from "./agent-history-menu";
import { AgentShareButton } from "./agent-share-button";
import { AgentSuggestions } from "./agent-suggestions";
import { AgentThread } from "./agent-thread";
import { getAgentErrorKey } from "./get-agent-error-key";
import { useAgentAttachments } from "./use-agent-attachments";
import { usePickPrompt } from "./use-pick-prompt";
import { useAgentProposalOverlay } from "./use-agent-proposal-overlay";
import { useBoardTaskKey } from "./use-board-task-key";

type AgentPanelProps = {
  workspaceId: string;
  projectId: string;
  projectName?: string;
};

export function AgentPanel({
  workspaceId,
  projectId,
  projectName,
}: AgentPanelProps) {
  const { t } = useTranslation();
  const conversationId = useAgentPanelStore(
    (state) => state.conversationIds[projectId],
  );
  const setConversation = useAgentPanelStore((state) => state.setConversation);
  const setOpen = useAgentPanelStore((state) => state.setOpen);
  const [draft, setDraft] = useState("");
  const attachments = useAgentAttachments(workspaceId);
  const { inputRef, pick } = usePickPrompt(setDraft);
  const runs = useAgentConversationRuns(workspaceId, conversationId);
  const latestId = runs.data?.at(-1)?.id;
  const { data: latestRun } = useAgentRun(workspaceId, latestId);
  const running = latestRun ? isAgentRunActive(latestRun.status) : false;
  const send = useSendAgentPrompt(workspaceId, projectId);
  const cancel = useCancelAgentRun(workspaceId);
  const getTaskKey = useBoardTaskKey(projectId);
  useAgentProposalOverlay(workspaceId, latestId);

  const handleSubmit = async (prompt: string) => {
    try {
      const result = await send.mutateAsync({
        conversationId,
        prompt,
        attachments: attachments.toRunInput(),
      });
      setConversation(projectId, result.conversationId);
      setDraft("");
      attachments.clear();
    } catch (error) {
      toast.error(t(getAgentErrorKey(error)));
    }
  };

  const handleStop = () => {
    if (!latestId) return;
    cancel.mutate(latestId, {
      onError: (error) => toast.error(t(getAgentErrorKey(error))),
    });
  };

  return (
    <aside
      aria-label={t("agent:panel.label")}
      className="fixed inset-y-2 right-2 z-40 flex w-[min(26.25rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-lg/10 lg:sticky lg:top-2 lg:my-2 lg:mr-2 lg:h-[calc(100svh-1rem)] lg:shrink-0 lg:shadow-sm/5"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-border/80 border-b pr-2 pl-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2 className="font-semibold text-foreground text-sm">
            {t("agent:title")}
          </h2>
          {projectName && (
            <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs">
              <FolderKanban aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {conversationId && (
            <AgentShareButton
              workspaceId={workspaceId}
              conversationId={conversationId}
            />
          )}
          <AgentHistoryMenu
            workspaceId={workspaceId}
            projectId={projectId}
            activeId={conversationId}
            onSelect={(id) => setConversation(projectId, id)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={t("agent:panel.newConversation")}
            disabled={!conversationId}
            onClick={() => setConversation(projectId, undefined)}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            aria-label={t("agent:panel.close")}
            onClick={() => setOpen(false)}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </header>

      {conversationId ? (
        <AgentThread
          workspaceId={workspaceId}
          runs={runs.data ?? []}
          isLoading={runs.isPending}
          isError={runs.isError}
          getTaskKey={getTaskKey}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 px-5 py-6">
          <p className="font-semibold text-foreground text-lg tracking-tight">
            {t("agent:panel.introTitle", { project: projectName ?? "" })}
          </p>
          <p className="text-muted-foreground text-sm">
            {t("agent:panel.introBody")}
          </p>
        </div>
      )}

      <div className="flex shrink-0 flex-col gap-2.5 px-3 pb-3">
        {!running && <AgentSuggestions onPick={pick} />}
        <AgentComposer
          value={draft}
          onValueChange={setDraft}
          attachments={attachments}
          onSubmit={(prompt) => void handleSubmit(prompt)}
          onStop={handleStop}
          placeholder={t("agent:composer.panelPlaceholder")}
          running={running}
          sending={send.isPending}
          autoFocus
          inputRef={inputRef}
          modelPicker={<AgentModelPicker workspaceId={workspaceId} />}
          mentionScope={{ workspaceId, projectId }}
        />
      </div>
    </aside>
  );
}
