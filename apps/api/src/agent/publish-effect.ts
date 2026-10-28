import { publishCommentCreated } from "../activity/controllers/create-comment";
import { publishCommentDeleted } from "../activity/controllers/delete-comment";
import { publishEvent } from "../events";
import { publishTaskMutation } from "../task/controllers/task-mutation-effects";
import { fromAgentComment } from "./comment-record";
import type { AgentEffect } from "./types";

// Publishes the normal domain events for a committed agent mutation.
export async function publishAgentEffect(payload: AgentEffect, userId: string) {
  if (payload.kind === "task.update") {
    const dates = (task: typeof payload.before) => ({
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
    });
    await publishTaskMutation(
      dates(payload.before),
      dates(payload.after),
      userId,
    );
    await publishEvent("task.updated", {
      taskId: payload.after.id,
      projectId: payload.after.projectId,
      userId,
    });
  } else if (payload.kind === "task.create") {
    await publishEvent("task.created", {
      ...payload.task,
      dueDate: payload.task.dueDate ? new Date(payload.task.dueDate) : null,
      startDate: payload.task.startDate
        ? new Date(payload.task.startDate)
        : null,
      createdAt: new Date(payload.task.createdAt),
      updatedAt: new Date(payload.task.updatedAt),
      taskId: payload.task.id,
      userId: payload.task.userId ?? "",
      currentUserId: userId,
      type: "created",
      content: null,
    });
  } else if (payload.kind === "comment.create") {
    await publishCommentCreated({
      activity: fromAgentComment(payload.comment),
      projectId: payload.projectId,
      summary: payload.summary,
      notifications: payload.notifications,
    });
  } else {
    await publishCommentDeleted(
      {
        comment: fromAgentComment(payload.comment),
        projectId: payload.projectId,
      },
      userId,
    );
  }
}
