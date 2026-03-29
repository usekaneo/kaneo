import * as v from "valibot";

const slackWebhookUrlPattern =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/;

export const slackEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type SlackEventKey = (typeof slackEventKeys)[number];

export const slackConfigSchema = v.object({
  webhookUrl: v.pipe(
    v.string(),
    v.regex(slackWebhookUrlPattern, "Invalid Slack webhook URL"),
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

export type SlackConfig = v.InferOutput<typeof slackConfigSchema>;

export const defaultSlackEvents: Record<SlackEventKey, boolean> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function getDefaultSlackConfig(webhookUrl: string): SlackConfig {
  return {
    webhookUrl,
    events: { ...defaultSlackEvents },
  };
}

export function normalizeSlackConfig(config: SlackConfig): SlackConfig {
  return {
    ...config,
    channelName: config.channelName?.trim() || undefined,
    events: {
      ...defaultSlackEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateSlackConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(slackConfigSchema, config);
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
