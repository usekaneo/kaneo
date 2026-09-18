import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { ChatConversation, ChatMessage } from "@/fetchers/chat";
import { getApiUrl } from "@/fetchers/get-api-url";
import {
  appendChatMessage,
  chatKeys,
  removeChatMessage,
  replaceChatMessage,
} from "@/hooks/chat";
import { useChatTypingStore } from "@/store/chat-typing";

type ChatEvent = {
  conversationId: string;
  message?: ChatMessage;
  messageId?: string;
  userId?: string;
  userName?: string;
  lastReadAt?: string;
};

/**
 * Live chat over server-sent events. EventSource reconnects by itself; each
 * (re)connect sends `ready`, and refetching then picks up anything missed
 * while the connection was down.
 */
export function useChatStream(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;

    const url = getApiUrl(
      `chat/stream?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    const source = new EventSource(url, { withCredentials: true });
    const typing = useChatTypingStore.getState();

    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.all(workspaceId) });
    const refreshList = () =>
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    const on = (type: string, handle: (event: ChatEvent) => void) =>
      source.addEventListener(type, (raw) => {
        try {
          handle(JSON.parse((raw as MessageEvent).data) as ChatEvent);
        } catch {
          // Ignore malformed events
        }
      });

    source.addEventListener("ready", refresh);
    on("CHAT_MESSAGE", ({ message }) => {
      if (!message) return;
      appendChatMessage(queryClient, workspaceId, message);
      if (message.userId) {
        typing.stopped(message.conversationId, message.userId);
      }
      void refreshList();
    });
    on("CHAT_MESSAGE_CHANGED", ({ message }) => {
      if (message) replaceChatMessage(queryClient, workspaceId, message);
    });
    on("CHAT_MESSAGE_DELETED", ({ conversationId, messageId }) => {
      if (messageId) {
        removeChatMessage(queryClient, workspaceId, conversationId, messageId);
      }
      void refreshList();
    });
    // Someone read the conversation: move their marker so "Seen" updates.
    on("CHAT_READ", ({ conversationId, userId, lastReadAt }) => {
      if (!userId || !lastReadAt) return;
      queryClient.setQueryData<ChatConversation[]>(
        chatKeys.conversations(workspaceId),
        (list) =>
          list?.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  members: c.members.map((m) =>
                    m.id === userId ? { ...m, lastReadAt } : m,
                  ),
                }
              : c,
          ),
      );
    });
    on("CHAT_TYPING", ({ conversationId, userId, userName }) => {
      if (userId) typing.started(conversationId, userId, userName ?? "");
    });
    source.addEventListener("CHAT_UPDATED", refresh);

    return () => source.close();
  }, [workspaceId, queryClient]);
}
