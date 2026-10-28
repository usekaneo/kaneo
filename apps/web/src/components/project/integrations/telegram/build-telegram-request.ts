import type { CreateTelegramIntegrationRequest } from "@/fetchers/telegram-integration/create-telegram-integration";
import type { UpdateTelegramIntegrationRequest } from "@/fetchers/telegram-integration/update-telegram-integration";
import type { TelegramFormValues } from "./telegram-form-values";

export type TelegramRequest =
  | {
      kind: "invalid";
      field: "botToken" | "chatId" | "threadId";
      messageKey: string;
    }
  | { kind: "create"; data: CreateTelegramIntegrationRequest }
  | { kind: "update"; json: UpdateTelegramIntegrationRequest };

function isValidBotToken(value: string): boolean {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(value);
}

function isValidThreadId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

export function buildTelegramRequest(
  values: TelegramFormValues,
  connected: boolean,
): TelegramRequest {
  const botToken = values.botToken.trim();
  const chatId = values.chatId.trim();
  const threadId = values.threadId.trim();
  const chatLabel = values.chatLabel.trim();
  const parsedThreadId = threadId ? Number(threadId) : undefined;

  if (!chatId) {
    return {
      kind: "invalid",
      field: "chatId",
      messageKey: "settings:telegramIntegration.validation.chatIdRequired",
    };
  }

  if (threadId && !isValidThreadId(threadId)) {
    return {
      kind: "invalid",
      field: "threadId",
      messageKey: "settings:telegramIntegration.validation.threadIdInvalid",
    };
  }

  if ((!connected || botToken) && !isValidBotToken(botToken)) {
    return {
      kind: "invalid",
      field: "botToken",
      messageKey: "settings:telegramIntegration.validation.botTokenInvalid",
    };
  }

  if (!connected) {
    return {
      kind: "create",
      data: {
        botToken,
        chatId,
        threadId: parsedThreadId,
        chatLabel: chatLabel || undefined,
        events: values.events,
      },
    };
  }

  return {
    kind: "update",
    json: {
      botToken: botToken || undefined,
      chatId,
      threadId: parsedThreadId ?? null,
      chatLabel: chatLabel || null,
      events: values.events,
    },
  };
}
