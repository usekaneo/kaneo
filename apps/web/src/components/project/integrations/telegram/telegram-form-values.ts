import { z } from "zod/v4";
import {
  type ChatEvents,
  toChatEvents,
} from "@/components/project/integrations/chat-webhook/chat-events";
import type { TelegramIntegration } from "@/fetchers/telegram-integration/get-telegram-integration";

export type TelegramFormValues = {
  botToken: string;
  chatId: string;
  threadId: string;
  chatLabel: string;
  events: ChatEvents;
};

export const telegramFormSchema = z.object({
  botToken: z.string(),
  chatId: z.string(),
  threadId: z.string(),
  chatLabel: z.string(),
  events: z.object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  }),
});

export function toTelegramFormValues(
  integration: TelegramIntegration | undefined,
): TelegramFormValues {
  return {
    botToken: "",
    chatId: integration?.chatId ?? "",
    threadId: integration?.threadId ? String(integration.threadId) : "",
    chatLabel: integration?.chatLabel ?? "",
    events: toChatEvents(integration?.events),
  };
}
