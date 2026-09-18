import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type ChatConversation,
  type ChatMessage,
  type ChatMessagePage,
  chatApi,
} from "@/fetchers/chat";

export const chatKeys = {
  all: (workspaceId: string) => ["chat", workspaceId] as const,
  conversations: (workspaceId: string) =>
    ["chat", workspaceId, "conversations"] as const,
  messages: (workspaceId: string, conversationId: string) =>
    ["chat", workspaceId, "messages", conversationId] as const,
};

type MessagePages = InfiniteData<ChatMessagePage, string | undefined>;

export function useChatConversations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.conversations(workspaceId ?? ""),
    queryFn: () => chatApi.conversations(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export function useChatMessages(workspaceId: string, conversationId: string) {
  // Pages run newest first: page 0 holds the latest messages and each next
  // page reaches further back.
  return useInfiniteQuery({
    queryKey: chatKeys.messages(workspaceId, conversationId),
    queryFn: ({ pageParam }) =>
      chatApi.messages(workspaceId, conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) =>
      page.hasMore ? page.messages[0]?.id : undefined,
    enabled: !!workspaceId && !!conversationId,
  });
}

function updatePages(
  queryClient: QueryClient,
  workspaceId: string,
  conversationId: string,
  update: (messages: ChatMessage[], pageIndex: number) => ChatMessage[],
) {
  queryClient.setQueryData<MessagePages>(
    chatKeys.messages(workspaceId, conversationId),
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page, index) => ({
          ...page,
          messages: update(page.messages, index),
        })),
      },
  );
}

/** Adds a message to the loaded history, once, whoever delivered it first. */
export function appendChatMessage(
  queryClient: QueryClient,
  workspaceId: string,
  message: ChatMessage,
) {
  const data = queryClient.getQueryData<MessagePages>(
    chatKeys.messages(workspaceId, message.conversationId),
  );
  if (data?.pages.some((p) => p.messages.some((m) => m.id === message.id))) {
    return;
  }
  updatePages(queryClient, workspaceId, message.conversationId, (list, i) =>
    i === 0 ? [...list, message] : list,
  );
}

/** Swaps in an edited message, or one whose reactions changed. */
export function replaceChatMessage(
  queryClient: QueryClient,
  workspaceId: string,
  message: ChatMessage,
) {
  updatePages(queryClient, workspaceId, message.conversationId, (list) =>
    list.map((m) => {
      if (m.id === message.id) return message;
      // Replies quoting an edited message show the new wording.
      if (m.replyTo?.id === message.id) {
        return { ...m, replyTo: { ...m.replyTo, body: message.body } };
      }
      return m;
    }),
  );
}

export function removeChatMessage(
  queryClient: QueryClient,
  workspaceId: string,
  conversationId: string,
  messageId: string,
) {
  updatePages(queryClient, workspaceId, conversationId, (list) =>
    list
      .filter((m) => m.id !== messageId)
      .map((m) => (m.replyTo?.id === messageId ? { ...m, replyTo: null } : m)),
  );
}

export function useChatActions(workspaceId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: chatKeys.all(workspaceId) });
  const replace = (message: ChatMessage) =>
    replaceChatMessage(queryClient, workspaceId, message);

  return {
    createChannel: useMutation({
      mutationFn: (input: {
        name: string;
        isPrivate: boolean;
        memberIds: string[];
      }) => chatApi.createChannel({ workspaceId, ...input }),
      onSuccess: refresh,
    }),
    openDm: useMutation({
      mutationFn: (userIds: string[]) => chatApi.openDm(workspaceId, userIds),
      onSuccess: refresh,
    }),
    join: useMutation({
      mutationFn: (id: string) => chatApi.join(workspaceId, id),
      onSuccess: refresh,
    }),
    leave: useMutation({
      mutationFn: (id: string) => chatApi.leave(workspaceId, id),
      onSuccess: refresh,
    }),
    addMembers: useMutation({
      mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
        chatApi.addMembers(workspaceId, id, userIds),
      onSuccess: refresh,
    }),
    deleteChannel: useMutation({
      mutationFn: (id: string) => chatApi.deleteChannel(workspaceId, id),
      onSuccess: refresh,
    }),
    send: useMutation({
      mutationFn: ({
        id,
        body,
        replyToId,
      }: {
        id: string;
        body: string;
        replyToId?: string;
      }) => chatApi.send(workspaceId, id, body, replyToId),
      onSuccess: (message) => {
        appendChatMessage(queryClient, workspaceId, message);
        void queryClient.invalidateQueries({
          queryKey: chatKeys.conversations(workspaceId),
        });
      },
    }),
    edit: useMutation({
      mutationFn: ({ messageId, body }: { messageId: string; body: string }) =>
        chatApi.edit(workspaceId, messageId, body),
      onSuccess: replace,
    }),
    react: useMutation({
      mutationFn: ({
        messageId,
        emoji,
      }: {
        messageId: string;
        emoji: string;
      }) => chatApi.react(workspaceId, messageId, emoji),
      onSuccess: replace,
    }),
    remove: useMutation({
      mutationFn: (message: ChatMessage) =>
        chatApi.remove(workspaceId, message.id),
      onSuccess: (_, message) => {
        removeChatMessage(
          queryClient,
          workspaceId,
          message.conversationId,
          message.id,
        );
        void queryClient.invalidateQueries({
          queryKey: chatKeys.conversations(workspaceId),
        });
      },
    }),
    markRead: useMutation({
      mutationFn: (id: string) => chatApi.markRead(workspaceId, id),
      // Clearing the badge locally avoids refetching the whole list.
      onSuccess: (_, id) =>
        queryClient.setQueryData<ChatConversation[]>(
          chatKeys.conversations(workspaceId),
          (list) =>
            list?.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
        ),
    }),
  };
}
