import { z } from "zod/v4";
import { type ChatEvents, toChatEvents } from "./chat-events";
import type { ChatWebhookIntegration } from "./chat-webhook-provider";

export type ChatWebhookFormValues = {
  webhookUrl: string;
  channelName: string;
  events: ChatEvents;
};

export const chatWebhookFormSchema = z.object({
  webhookUrl: z.string(),
  channelName: z.string(),
  events: z.object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  }),
});

export function toChatWebhookFormValues(
  integration: ChatWebhookIntegration | undefined,
): ChatWebhookFormValues {
  return {
    webhookUrl: "",
    channelName: integration?.channelName ?? "",
    events: toChatEvents(integration?.events),
  };
}
