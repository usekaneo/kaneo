import * as v from "valibot";

const mattermostWebhookUrlPattern = /^https:\/\/[^\s]+$/;

export const mattermostEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type MattermostEventKey = (typeof mattermostEventKeys)[number];

export const mattermostConfigSchema = v.object({
  webhookUrl: v.pipe(
    v.string(),
    v.regex(mattermostWebhookUrlPattern, "Webhook URL must be an HTTPS URL"),
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

export type MattermostConfig = v.InferOutput<typeof mattermostConfigSchema>;

export const defaultMattermostEvents: Record<MattermostEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function getDefaultMattermostConfig(
  webhookUrl: string,
): MattermostConfig {
  return {
    webhookUrl,
    events: { ...defaultMattermostEvents },
  };
}

export function normalizeMattermostConfig(
  config: MattermostConfig,
): MattermostConfig {
  return {
    ...config,
    channelName: config.channelName?.trim() || undefined,
    events: {
      ...defaultMattermostEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateMattermostConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(mattermostConfigSchema, config);
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
