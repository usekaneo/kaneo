import * as v from "valibot";

const googleChatWebhookUrlPattern =
  /^https:\/\/chat\.googleapis\.com\/v1\/spaces\/[^/\s]+\/messages\?(?=[^\s]*\bkey=[^&\s]+)(?=[^\s]*\btoken=[^&\s]+)[^\s]+$/;

export const googleChatEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type GoogleChatEventKey = (typeof googleChatEventKeys)[number];

export const googleChatConfigSchema = v.object({
  webhookUrl: v.pipe(
    v.string(),
    v.regex(googleChatWebhookUrlPattern, "Invalid Google Chat webhook URL"),
  ),
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

export type GoogleChatConfig = v.InferOutput<typeof googleChatConfigSchema>;

export const defaultGoogleChatEvents: Record<GoogleChatEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function getDefaultGoogleChatConfig(
  webhookUrl: string,
): GoogleChatConfig {
  return {
    webhookUrl,
    events: { ...defaultGoogleChatEvents },
  };
}

export function normalizeGoogleChatConfig(
  config: GoogleChatConfig,
): GoogleChatConfig {
  return {
    ...config,
    channelName: config.channelName?.trim() || undefined,
    events: {
      ...defaultGoogleChatEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateGoogleChatConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(googleChatConfigSchema, config);
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
