import { z } from "zod/v4";
import type { GenericWebhookIntegration } from "@/fetchers/generic-webhook-integration/get-generic-webhook-integration";
import {
  type GenericWebhookEvents,
  toGenericWebhookEvents,
} from "./generic-webhook-events";

export const MIN_LEAD_TIME_HOURS = 5 / 60;
export const MAX_LEAD_TIME_HOURS = 720;

export type GenericWebhookFormValues = {
  webhookUrl: string;
  secret: string;
  events: GenericWebhookEvents;
  dueDateReminderLeadTimeHours: number;
};

export function createGenericWebhookFormSchema(leadTimeMessage: string) {
  return z
    .object({
      webhookUrl: z.string(),
      secret: z.string(),
      events: z.object({
        taskCreated: z.boolean(),
        taskStatusChanged: z.boolean(),
        taskPriorityChanged: z.boolean(),
        taskTitleChanged: z.boolean(),
        taskDescriptionChanged: z.boolean(),
        taskCommentCreated: z.boolean(),
        taskDeleted: z.boolean(),
        taskMoved: z.boolean(),
        taskDueDateChanged: z.boolean(),
        taskAssigneeChanged: z.boolean(),
        taskUnassigned: z.boolean(),
        dueDateReminder: z.boolean(),
      }),
      dueDateReminderLeadTimeHours: z.number(),
    })
    .refine(
      (values) =>
        !values.events.dueDateReminder ||
        (values.dueDateReminderLeadTimeHours >= MIN_LEAD_TIME_HOURS &&
          values.dueDateReminderLeadTimeHours <= MAX_LEAD_TIME_HOURS),
      { path: ["dueDateReminderLeadTimeHours"], message: leadTimeMessage },
    );
}

export function toGenericWebhookFormValues(
  integration: GenericWebhookIntegration | null | undefined,
): GenericWebhookFormValues {
  return {
    webhookUrl: "",
    secret: "",
    events: toGenericWebhookEvents(integration?.events),
    dueDateReminderLeadTimeHours:
      (integration?.dueDateReminderLeadTimeMinutes ?? 1440) / 60,
  };
}
