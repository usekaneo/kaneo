import * as v from "valibot";

export const discordEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type DiscordEventKey = (typeof discordEventKeys)[number];

const discordWebhookSchema = v.pipe(
  v.string(),
  v.url(),
  v.regex(
    /^https:\/\/(?:discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/\s]+$/i,
    "Enter a valid Discord webhook URL",
  ),
);

export const discordConfigSchema = v.object({
  webhookUrl: discordWebhookSchema,
  channelName: v.optional(v.string()),
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

export type DiscordConfig = v.InferOutput<typeof discordConfigSchema>;

export const defaultDiscordEvents: Record<DiscordEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function getDefaultDiscordConfig(webhookUrl: string): DiscordConfig {
  return {
    webhookUrl,
    events: { ...defaultDiscordEvents },
  };
}

export function normalizeDiscordConfig(config: DiscordConfig): DiscordConfig {
  return {
    ...config,
    channelName: config.channelName?.trim() || undefined,
    events: {
      ...defaultDiscordEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateDiscordConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    const parsed = v.parse(discordConfigSchema, config);
    normalizeDiscordConfig(parsed);
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
