import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { CommentCreateFailed } from "../../comment/errors";
import { Notifications } from "../../comment/services";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import { parseMentionIds } from "../../utils/parse-mentions";

const createComment = Effect.fn("comment.createComment")(function* (
  taskId: string,
  userId: string,
  content: string,
  external?: { userName: string; source: string },
) {
  const database = yield* Database;
  const events = yield* Events;
  const notifications = yield* Notifications;

  const [activity] = yield* database.query((db) =>
    db
      .insert(activityTable)
      .values({
        taskId,
        type: "comment",
        userId,
        content,
        ...(external
          ? {
              externalUserName: external.userName,
              externalSource: external.source,
            }
          : {}),
      })
      .returning(),
  );

  if (!activity) {
    return yield* new CommentCreateFailed({ taskId });
  }

  const [user] = yield* database.query((db) =>
    db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, userId)),
  );

  const [task] = yield* database.query((db) =>
    db
      .select({
        assigneeId: taskTable.userId,
        projectId: taskTable.projectId,
        title: taskTable.title,
        workspaceId: projectTable.workspaceId,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(eq(taskTable.id, taskId)),
  );

  if (task) {
    yield* events.publish("comment.created", {
      ...activity,
      comment: `**${user?.name}** commented:\n> ${content}`,
      projectId: task.projectId,
    });
  }

  // Notify any workspace members @mentioned in the comment (not the author).
  const mentionedIds = parseMentionIds(content).filter((id) => id !== userId);
  for (const mentionedId of mentionedIds) {
    yield* notifications.create({
      userId: mentionedId,
      type: "task_mention",
      eventData: {
        taskTitle: task?.title ?? null,
        mentionerName: user?.name ?? null,
        projectId: task?.projectId ?? null,
        workspaceId: task?.workspaceId ?? null,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  if (
    task?.assigneeId &&
    task.assigneeId !== userId &&
    !mentionedIds.includes(task.assigneeId)
  ) {
    yield* notifications.create({
      userId: task.assigneeId,
      type: "task_comment",
      eventData: {
        taskTitle: task.title,
        commenterName: user?.name ?? null,
        commentPreview: content.slice(0, 160),
        projectId: task.projectId,
        workspaceId: task.workspaceId,
      },
      resourceId: taskId,
      resourceType: "task",
    });
  }

  return activity;
});

export default createComment;
