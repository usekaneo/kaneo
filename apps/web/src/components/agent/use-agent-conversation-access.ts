import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import useAgentConversation from "@/hooks/queries/agent/use-agent-conversation";

// Only the owner acts on a conversation; shared viewers are read-only. Until
// the conversation loads, nobody is treated as the owner.
export function useAgentConversationAccess(
  workspaceId: string,
  conversationId: string | undefined,
) {
  const { user } = useAuth();
  const { data: conversation } = useAgentConversation(
    workspaceId,
    conversationId,
  );
  const isOwner = Boolean(
    conversation && user && conversation.userId === user.id,
  );
  return { conversation, isOwner };
}
