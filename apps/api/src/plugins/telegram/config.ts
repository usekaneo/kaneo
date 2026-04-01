import * as v from "valibot";

export const telegramEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type TelegramEventKey = (typeof telegramEventKeys)[number];

const telegramBotTokenSchema = v.pipe(
  v.string(),
  v.regex(/^\d{8,10}:[A-Za-z0-9_-]{35}$/, "Enter a valid Telegram bot token"),
);

const telegramChatIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, "Chat ID is required"),
);

export const telegramConfigSchema = v.object({
  botToken: telegramBotTokenSchema,
  chatId: telegramChatIdSchema,
  threadId: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
  chatLabel: v.optional(v.string()),
  events: v.optional(
    v.object({
      taskCreated: v.optional(v.boolean()),
      taskStatusChanged: v.optional(v.boolean()),
      taskPriorityChanged: v.optional(v.boolean()),
      taskTitleChanged: v.optional(v.boolean()),
      taskDescriptionChanged: v.optional(v.boolean()),
      taskCommentCreated: v.optional(v.boolean()),
    }),
  ),
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

export async function validateTelegramConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
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
