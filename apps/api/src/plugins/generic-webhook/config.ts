import * as v from "valibot";
import { assertPublicDestination } from "../../utils/assert-public-destination";

export async function assertPublicWebhookDestination(
  webhookUrl: string,
): Promise<void> {
  await assertPublicDestination(webhookUrl, "Generic webhook");
}

export const genericWebhookEventKeys = [
  "taskCreated",
  "taskStatusChanged",
  "taskPriorityChanged",
  "taskTitleChanged",
  "taskDescriptionChanged",
  "taskCommentCreated",
  "taskDeleted",
  "taskMoved",
  "taskDueDateChanged",
  "taskAssigneeChanged",
  "taskUnassigned",
  "dueDateReminder",
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
      taskDeleted: v.optional(v.boolean()),
      taskMoved: v.optional(v.boolean()),
      taskDueDateChanged: v.optional(v.boolean()),
      taskAssigneeChanged: v.optional(v.boolean()),
      taskUnassigned: v.optional(v.boolean()),
      dueDateReminder: v.optional(v.boolean()),
    }),
  ),
  dueDateReminderLeadTimeMinutes: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(5), v.maxValue(43_200)),
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
  taskDeleted: false,
  taskMoved: false,
  taskDueDateChanged: false,
  taskAssigneeChanged: false,
  taskUnassigned: false,
  dueDateReminder: false,
};

export function normalizeGenericWebhookConfig(
  config: GenericWebhookConfig,
): GenericWebhookConfig {
  const secret =
    typeof config.secret === "string"
      ? config.secret.trim() || undefined
      : undefined;

  return {
    ...config,
    secret,
    health: config.health
      ? {
          ...config.health,
          failureCount: config.health.failureCount ?? 0,
        }
      : undefined,
    dueDateReminderLeadTimeMinutes:
      config.dueDateReminderLeadTimeMinutes ?? 1440,
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
    await assertPublicWebhookDestination(parsed.webhookUrl);
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
