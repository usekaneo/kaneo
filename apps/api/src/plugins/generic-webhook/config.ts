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
  webhookUrl: v.pipe(v.string(), v.url()),
  secret: v.optional(v.string()),
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
    const parsed = v.parse(genericWebhookConfigSchema, config);
    normalizeGenericWebhookConfig(parsed);
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
