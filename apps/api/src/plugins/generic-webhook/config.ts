import * as v from "valibot";

export const genericWebhookEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
] as const;

export type GenericWebhookEventKey = (typeof genericWebhookEventKeys)[number];

export const genericWebhookConfigSchema = v.object({
  webhookUrl: v.pipe(
    v.string(),
    v.url(),
    v.check((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Webhook URL must use http or https"),
  ),
  secret: v.optional(v.string()),
  health: v.optional(
    v.object({
      lastSuccessAt: v.optional(v.string()),
      lastFailureAt: v.optional(v.string()),
      lastFailureMessage: v.optional(v.string()),
      failureCount: v.optional(v.number()),
      lastAttempt: v.optional(
        v.object({
          eventName: v.string(),
          taskId: v.string(),
          projectId: v.string(),
          webhookUrl: v.string(),
        }),
      ),
    }),
  ),
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

export type GenericWebhookConfig = v.InferOutput<
  typeof genericWebhookConfigSchema
>;

export const defaultGenericWebhookEvents: Record<
  GenericWebhookEventKey,
  boolean
> = {
  taskCreated: true,
  taskStatusChanged: true,
  taskPriorityChanged: false,
  taskTitleChanged: false,
  taskDescriptionChanged: false,
  taskCommentCreated: true,
};

export function normalizeGenericWebhookConfig(
  config: GenericWebhookConfig,
): GenericWebhookConfig {
  return {
    ...config,
    secret: config.secret?.trim() || undefined,
    health: config.health
      ? {
          ...config.health,
          failureCount: config.health.failureCount ?? 0,
        }
      : undefined,
    events: {
      ...defaultGenericWebhookEvents,
      ...(config.events ?? {}),
    },
  };
}

export async function validateGenericWebhookConfig(
  config: unknown,
): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    v.parse(genericWebhookConfigSchema, config);
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
