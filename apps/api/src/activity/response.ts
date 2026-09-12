import { responseTimestamp, z } from "../openapi";

const activityTypeDescription =
  "One of: comment, task, create, status_changed, priority_changed, assignee_changed, unassigned, due_date_changed, title_changed, description_changed.";

export const activitySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    type: z.string().openapi({ description: activityTypeDescription }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    userId: z.string().nullable(),
    content: z.string().nullable(),
    eventData: z.unknown().openapi({
      description:
        "Type-specific payload, e.g. { oldStatus, newStatus } for status_changed. Null for plain comments.",
    }),
    externalUserName: z.string().nullable().openapi({
      description: "Set when the activity was imported from another tool.",
    }),
    externalUserAvatar: z.string().nullable(),
    externalSource: z.string().nullable().openapi({
      description: "The tool it was imported from, e.g. planka, trello, jira.",
    }),
    externalUrl: z.string().nullable(),
  })
  .openapi("Activity");

export const activityListSchema = z.array(activitySchema);
