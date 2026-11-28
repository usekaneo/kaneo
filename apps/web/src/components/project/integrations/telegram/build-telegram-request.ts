import type { CreateTelegramIntegrationRequest } from "@/fetchers/telegram-integration/create-telegram-integration";
import type { UpdateTelegramIntegrationRequest } from "@/fetchers/telegram-integration/update-telegram-integration";
import type { TelegramFormValues } from "./telegram-form-values";

export type TelegramRequest =
  | {
      kind: "invalid";
      field: "botToken" | "serverUrl" | "chatId" | "threadId";
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

function isValidServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeServerUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function buildTelegramRequest(
  values: TelegramFormValues,
  connected: boolean,
  savedServerUrl: string | null = null,
): TelegramRequest {
  const botToken = values.botToken.trim();
  const serverUrl = normalizeServerUrl(values.serverUrl);
  const serverChanged = serverUrl !== (savedServerUrl ?? "");
  const chatId = values.chatId.trim();
  const threadId = values.threadId.trim();
  const chatLabel = values.chatLabel.trim();
  const parsedThreadId = threadId ? Number(threadId) : undefined;

  if (serverUrl && !isValidServerUrl(serverUrl)) {
    return {
      kind: "invalid",
      field: "serverUrl",
      messageKey: "settings:telegramIntegration.validation.serverUrlInvalid",
    };
  }

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

  // The API only accepts a server change together with the bot token
  if (connected && !botToken && serverChanged) {
    return {
      kind: "invalid",
      field: "botToken",
      messageKey:
        "settings:telegramIntegration.validation.botTokenRequiredForServer",
    };
  }

  if (!connected) {
    return {
      kind: "create",
      data: {
        botToken,
        serverUrl: serverUrl || undefined,
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
      ...(serverChanged ? { serverUrl: serverUrl || null } : {}),
      chatId,
      threadId: parsedThreadId ?? null,
      chatLabel: chatLabel || null,
      events: values.events,
    },
  };
}
