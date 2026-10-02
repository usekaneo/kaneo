import { pagingNumber, z } from "../openapi";

export const activitiesQuery = z.object({
  limit: pagingNumber(1, 100).optional().openapi({
    description: "Maximum number of recent activities; omit for the full feed.",
  }),
});

export const taskIdParam = z.object({ taskId: z.string() });

export const workspaceIdParam = z.object({ workspaceId: z.string().min(1) });

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
  comment: z.string().max(10_000),
});

export const updateCommentBody = z.object({
  activityId: z.string(),
  comment: z.string().max(10_000),
});

export const deleteCommentBody = z.object({ activityId: z.string() });
