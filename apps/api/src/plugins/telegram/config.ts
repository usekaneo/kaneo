import * as v from "valibot";
import { privateDestinationsAllowed } from "../../utils/assert-public-destination";

export const TELEGRAM_API_URL = "https://api.telegram.org";

export const telegramEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type TelegramEventKey = (typeof telegramEventKeys)[number];

export const telegramEventsSchema = v.object(
  Object.fromEntries(
    telegramEventKeys.map((key) => [key, v.optional(v.boolean())]),
  ) as Record<
    TelegramEventKey,
    v.OptionalSchema<v.BooleanSchema<undefined>, never>
  >,
);

const telegramBotTokenSchema = v.pipe(
  v.string(),
  v.regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, "Enter a valid Telegram bot token"),
);

const telegramChatIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Chat ID is required"),
);

// A query or fragment would swallow the /bot<token>/<method> path appended later
export function isPlainServerUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !/[?#]/.test(value) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

const telegramServerUrlSchema = v.pipe(
  v.string(),
  v.url("Enter a valid Bot API server URL"),
  v.check(
    isPlainServerUrl,
    "Bot API server URL must use http or https, without a query, fragment, or credentials",
  ),
);

export const telegramConfigSchema = v.object({
  botToken: telegramBotTokenSchema,
  serverUrl: v.optional(telegramServerUrlSchema),
  chatId: telegramChatIdSchema,
  threadId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  chatLabel: v.optional(v.string()),
  events: v.optional(telegramEventsSchema),
});

export type TelegramConfig = v.InferOutput<typeof telegramConfigSchema>;

export const defaultTelegramEvents: Record<TelegramEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function normalizeTelegramConfig(
  config: TelegramConfig,
): TelegramConfig {
  return {
    ...config,
    serverUrl: config.serverUrl?.trim().replace(/\/+$/, "") || undefined,
    threadId:
      typeof config.threadId === "number" && Number.isFinite(config.threadId)
        ? config.threadId
        : undefined,
    chatLabel: config.chatLabel?.trim() || undefined,
    events: {
      ...defaultTelegramEvents,
      ...(config.events ?? {}),
    },
  };
}

// The bot token travels in the request path, so plain http is only accepted
// for servers on a private network.
export function assertTelegramTransport(serverUrl: string): void {
  if (
    new URL(serverUrl).protocol === "http:" &&
    !privateDestinationsAllowed()
  ) {
    throw new Error(
      "Bot API server URL must use https unless KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS is enabled",
    );
  }
}

export function validateTelegramConfig(config: unknown): {
  valid: boolean;
  errors?: string[];
} {
  try {
    const parsed = v.parse(telegramConfigSchema, config);
    normalizeTelegramConfig(parsed);
    return { valid: true };
  } catch (error) {
    if (error instanceof v.ValiError) {
      return {
        valid: false,
        errors: error.issues.map((issue) => issue.message),
      };
    }

    return {
      valid: false,
      errors: [error instanceof Error ? error.message : "Invalid config"],
    };
  }
}
