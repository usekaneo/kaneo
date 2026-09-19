import { eq } from "drizzle-orm";
import db from "../database";
import { taskTable } from "../database/schema";
import { subscribeToEvent } from "../events";
import { broadcastToUser } from "../ws";

/**
 * Keeps each user's "My tasks" view current. The board sockets are scoped to a
 * project, but an assignee's list spans every project they are in, so changes
 * are pushed on the user-scoped socket instead: one message to the current
 * assignee and, when the assignment itself changed, to the previous one.
 */
export const ASSIGNED_TASKS_UPDATED = "ASSIGNED_TASKS_UPDATED";

type TaskEventPayload = {
  taskId?: string;
  projectId?: string;
  toProjectId?: string;
  userId?: string;
  assigneeId?: string | null;
  previousAssigneeId?: string | null;
  newAssigneeId?: string | null;
  oldAssignee?: string | null;
};

async function currentAssignee(taskId: string) {
  const [task] = await db
    .select({ userId: taskTable.userId })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);
  return task?.userId ?? null;
}

/**
 * Publishers name the assignee under a few different keys, and only on
 * `task.created` is `userId` the assignee rather than the actor. Events that
 * name nobody (label and field changes) fall back to one lookup; a delete is
 * the exception, since its row is gone and its publishers pass `assigneeId`.
 */
export async function resolveAffectedAssignees(
  eventName: string,
  data: TaskEventPayload,
): Promise<string[]> {
  const ids = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) ids.add(id);
  };

  if (eventName === "task.created") add(data.userId);
  add(data.assigneeId);
  add(data.previousAssigneeId);
  add(data.oldAssignee);
  add(data.newAssigneeId);

  if (ids.size === 0 && data.taskId && eventName !== "task.deleted") {
    add(await currentAssignee(data.taskId));
  }

  return [...ids];
}

export function notifyAssignees(
  eventName: string,
  data: TaskEventPayload,
  assignees: string[],
) {
  const projectId = data.toProjectId ?? data.projectId;
  for (const userId of assignees) {
    broadcastToUser(userId, {
      type: ASSIGNED_TASKS_UPDATED,
      taskId: data.taskId,
      projectId,
      event: eventName,
    });
  }
}

const subscribedEvents = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.moved",
  "task.unassigned",
  "task.assignee_changed",
  "task.status_changed",
  "task.priority_changed",
  "task.due_date_changed",
  "task.title_changed",
  "task.description_changed",
  "task.label_assigned",
  "task.label_unassigned",
  "task.label_created",
  "task.label_deleted",
];

let registered = false;

/**
 * Called from `createApp()`. Guarded because tests build the app many times
 * in one process and a second registration would double every broadcast.
 */
export function registerAssignedTasksRealtime() {
  if (registered) return;
  registered = true;

  for (const eventName of subscribedEvents) {
    subscribeToEvent<TaskEventPayload>(eventName, async (data) => {
      if (!data.taskId) return;
      try {
        const assignees = await resolveAffectedAssignees(eventName, data);
        notifyAssignees(eventName, data, assignees);
      } catch (error) {
        console.error(
          `Failed to notify assignees for ${eventName}:`,
          error instanceof Error ? error.message : error,
        );
      }
    });
  }
}
