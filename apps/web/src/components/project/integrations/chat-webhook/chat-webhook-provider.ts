import type { ChatEvents } from "./chat-events";

export type ChatWebhookIntegration = {
  id: string;
  channelName: string | null;
  webhookConfigured: boolean;
  events: ChatEvents;
  isActive: boolean | null;
} | null;

export type ChatWebhookCreateRequest = {
  webhookUrl: string;
  channelName?: string;
  events?: Partial<ChatEvents>;
};

export type ChatWebhookUpdateRequest = {
  webhookUrl?: string;
  channelName?: string | null;
  isActive?: boolean;
  events?: Partial<ChatEvents>;
};

type ChatWebhookMutation<TVariables> = {
  mutateAsync: (variables: TVariables) => Promise<unknown>;
  isPending: boolean;
};

export type ChatWebhookProvider = {
  name: string;
  webhookUrlPattern: RegExp;
  emptyChannelName: null | undefined;
  keys: {
    webhookPlaceholder: string;
    webhookHint: string;
    webhookInvalid: string;
    connect: string;
    saved: string;
    saveError: string;
    enabled: string;
    disabled: string;
    updateError: string;
    removed: string;
    removeError: string;
  };
  useIntegration: (projectId: string) => {
    data: ChatWebhookIntegration | undefined;
    isLoading: boolean;
  };
  useCreateIntegration: () => ChatWebhookMutation<{
    projectId: string;
    data: ChatWebhookCreateRequest;
  }>;
  useUpdateIntegration: () => ChatWebhookMutation<{
    projectId: string;
    json: ChatWebhookUpdateRequest;
  }>;
  useDeleteIntegration: () => ChatWebhookMutation<string>;
};
