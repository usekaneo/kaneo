import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

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
    replyToId: z.string().nullable().openapi({
      description: "Comments only: the comment this one replies to.",
    }),
    editedAt: nullableResponseTimestamp.openapi({
      description: "When the author last edited the comment.",
    }),
  })
  .openapi("Activity");

export const feedActivitySchema = activitySchema
  .extend({
    replyTo: z
      .object({
        id: z.string(),
        userId: z.string().nullable(),
        userName: z.string().nullable(),
        excerpt: z.string(),
      })
      .nullable()
      .openapi({
        description: "The quoted comment; null once it has been deleted.",
      }),
    reactions: z.array(
      z.object({ emoji: z.string(), userIds: z.array(z.string()) }),
    ),
  })
  .openapi("FeedActivity");

export const activityListSchema = z.array(feedActivitySchema);
