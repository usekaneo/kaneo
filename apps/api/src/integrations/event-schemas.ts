import { z } from "../openapi";

const integrationEvents = z.object({
  taskCreated: z.boolean(),
  taskStatusChanged: z.boolean(),
  taskPriorityChanged: z.boolean(),
  taskTitleChanged: z.boolean(),
  taskDescriptionChanged: z.boolean(),
  taskCommentCreated: z.boolean(),
});

const genericWebhookOnlyEvents = {
  taskDeleted: z.boolean(),
  taskMoved: z.boolean(),
  taskDueDateChanged: z.boolean(),
  taskAssigneeChanged: z.boolean(),
  taskUnassigned: z.boolean(),
  dueDateReminder: z.boolean(),
};

export const integrationEventToggles = integrationEvents.partial();
export const genericWebhookEventToggles = integrationEvents
  .extend(genericWebhookOnlyEvents)
  .partial();

export const integrationEventsSchema =
  integrationEvents.openapi("IntegrationEvents");
export const genericWebhookEventsSchema = integrationEventsSchema
  .extend(genericWebhookOnlyEvents)
  .openapi("GenericWebhookEvents");
