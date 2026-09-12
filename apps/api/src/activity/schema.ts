import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const createActivityBody = z.object({
  taskId: z.string(),
  message: z.string().nullable().openapi({
    description:
      "Free-text body. Null for events whose meaning is in eventData.",
  }),
  type: z.string().openapi({
    description: "The event kind, e.g. status_changed or assignee_changed.",
  }),
  eventData: z.record(z.string(), z.unknown()).nullable().optional().openapi({
    description: "Type-specific payload stored alongside the event.",
  }),
});

export const createCommentBody = z.object({
  taskId: z.string(),
  comment: z.string(),
});

export const updateCommentBody = z.object({
  activityId: z.string(),
  comment: z.string(),
});

export const deleteCommentBody = z.object({ activityId: z.string() });
