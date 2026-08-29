import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const integrationEventToggles = z.object({
  taskCreated: z.boolean().optional(),
  taskStatusChanged: z.boolean().optional(),
  taskPriorityChanged: z.boolean().optional(),
  taskTitleChanged: z.boolean().optional(),
  taskDescriptionChanged: z.boolean().optional(),
  taskCommentCreated: z.boolean().optional(),
});

export const genericWebhookEventToggles = integrationEventToggles.extend({
  taskDeleted: z.boolean().optional(),
  taskMoved: z.boolean().optional(),
  taskDueDateChanged: z.boolean().optional(),
  taskAssigneeChanged: z.boolean().optional(),
  taskUnassigned: z.boolean().optional(),
  dueDateReminder: z.boolean().optional(),
});

export const deletedSchema = z.object({ success: z.boolean() });

export const projectIdBody = z.object({ projectId: z.string() });
