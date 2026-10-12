import type { ChatWebhookFormValues } from "./chat-webhook-form-values";
import type {
  ChatWebhookCreateRequest,
  ChatWebhookProvider,
  ChatWebhookUpdateRequest,
} from "./chat-webhook-provider";
import { isValidChatWebhookUrl } from "./is-valid-chat-webhook-url";

export type ChatWebhookRequest =
  | { kind: "invalid" }
  | { kind: "create"; data: ChatWebhookCreateRequest }
  | { kind: "update"; json: ChatWebhookUpdateRequest };

export function buildChatWebhookRequest(
  values: ChatWebhookFormValues,
  connected: boolean,
  provider: Pick<ChatWebhookProvider, "webhookUrlPattern" | "emptyChannelName">,
): ChatWebhookRequest {
  const webhookUrl = values.webhookUrl.trim();
  const channelName = values.channelName.trim();
  const validUrl = isValidChatWebhookUrl(
    webhookUrl,
    provider.webhookUrlPattern,
  );

  if (!connected) {
    if (!validUrl) {
      return { kind: "invalid" };
    }

    return {
      kind: "create",
      data: {
        webhookUrl,
        channelName: channelName || undefined,
        events: values.events,
      },
    };
  }

  if (webhookUrl && !validUrl) {
    return { kind: "invalid" };
  }

  return {
    kind: "update",
    json: {
      webhookUrl: webhookUrl || undefined,
      channelName: channelName || provider.emptyChannelName,
      events: values.events,
    },
  };
}
