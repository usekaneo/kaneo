import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSendAgentPrompt from "@/hooks/mutations/agent/use-send-agent-prompt";
import { toast } from "@/lib/toast";
import { AgentComposer } from "./agent-composer";
import { AgentExamples } from "./agent-examples";
import { AgentRecentRuns } from "./agent-recent-runs";
import { AgentUnavailable } from "./agent-unavailable";
import { getAgentErrorKey } from "./get-agent-error-key";
import { usePickPrompt } from "./use-pick-prompt";
import type { AgentAttachmentDraft } from "./read-agent-attachments";

type AgentHomeProps = {
  workspaceId: string;
  enabled: boolean;
  onOpenConversation: (conversationId: string) => void;
};

export function AgentHome({
  workspaceId,
  enabled,
  onOpenConversation,
}: AgentHomeProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AgentAttachmentDraft[]>([]);
  const { inputRef, pick } = usePickPrompt(setDraft);
  const send = useSendAgentPrompt(workspaceId);

  const handleSubmit = async (prompt: string) => {
    try {
      const { conversationId } = await send.mutateAsync({
        prompt,
        attachments,
      });
      onOpenConversation(conversationId);
    } catch (error) {
      toast.error(t(getAgentErrorKey(error)));
    }
  };

  return (
    <div className="flex justify-center px-6 py-10 sm:px-14">
      <div className="flex w-full max-w-5xl flex-col gap-11">
        <section className="flex flex-col gap-5 pt-6">
          <h1 className="font-semibold text-3xl text-foreground tracking-tight">
            {t("agent:home.title")}
          </h1>
          {enabled ? (
            <AgentComposer
              variant="hero"
              value={draft}
              onValueChange={setDraft}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              onSubmit={(prompt) => void handleSubmit(prompt)}
              placeholder={t("agent:home.placeholder")}
              sending={send.isPending}
              autoFocus
              inputRef={inputRef}
            />
          ) : (
            <AgentUnavailable />
          )}
        </section>
        {enabled && <AgentExamples onPick={pick} />}
        <AgentRecentRuns
          workspaceId={workspaceId}
          onOpen={onOpenConversation}
        />
      </div>
    </div>
  );
}
