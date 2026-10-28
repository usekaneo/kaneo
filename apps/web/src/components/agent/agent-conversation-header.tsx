import { AgentOwnerAvatar } from "./agent-owner-avatar";
import { AgentShareButton } from "./agent-share-button";
import { AgentSharedIndicator } from "./agent-shared-indicator";
import { useAgentConversationAccess } from "./use-agent-conversation-access";

type AgentConversationHeaderProps = {
  workspaceId: string;
  conversationId: string;
};

// The owner gets the share toggle; shared viewers see whose conversation it is.
export function AgentConversationHeader({
  workspaceId,
  conversationId,
}: AgentConversationHeaderProps) {
  const { conversation, isOwner } = useAgentConversationAccess(
    workspaceId,
    conversationId,
  );

  if (!conversation) return null;
  if (isOwner)
    return (
      <AgentShareButton
        workspaceId={workspaceId}
        conversationId={conversationId}
      />
    );

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      <AgentSharedIndicator />
      <AgentOwnerAvatar owner={conversation.owner} />
      <span className="truncate font-medium text-foreground">
        {conversation.owner.name}
      </span>
    </span>
  );
}
