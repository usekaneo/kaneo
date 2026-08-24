import { z } from "../openapi";

// Which task events a chat/webhook integration forwards. Every integration
// stores the full set with defaults applied, so none of these are optional on
// the way out.
export const integrationEventsSchema = z
  .object({
    taskCreated: z.boolean(),
    taskStatusChanged: z.boolean(),
    taskPriorityChanged: z.boolean(),
    taskTitleChanged: z.boolean(),
    taskDescriptionChanged: z.boolean(),
    taskCommentCreated: z.boolean(),
  })
  .openapi("IntegrationEvents");

export const genericWebhookEventsSchema = integrationEventsSchema
  .extend({
    taskDeleted: z.boolean(),
    taskMoved: z.boolean(),
    taskDueDateChanged: z.boolean(),
    taskAssigneeChanged: z.boolean(),
    taskUnassigned: z.boolean(),
    dueDateReminder: z.boolean(),
  })
  .openapi("GenericWebhookEvents");
