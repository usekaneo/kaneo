import { eq } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  taskReminderSentTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import createNotification from "../../notification/controllers/create-notification";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import { parseMentionIds } from "../../utils/parse-mentions";

type Task = typeof taskTable.$inferSelect;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Changes = Partial<
  Pick<
    Task,
    "title" | "status" | "priority" | "description" | "userId" | "dueDate"
  >
>;
export type TaskBefore = Pick<
  Task,
  "id" | "projectId" | "title" | "status" | "priority" | "userId" | "dueDate"
> & { description?: string | null; columnId?: string | null };

export async function recordTaskMutation(
  tx: Transaction,
  before: TaskBefore,
  changes: Changes,
  userId?: string,
) {
  if (changes.title !== undefined && before.title !== changes.title) {
    await tx.insert(activityTable).values({
      taskId: before.id,
      type: "title_changed",
      userId: userId ?? null,
      content: null,
      eventData: { oldTitle: before.title, newTitle: changes.title },
    });
  }
  if (
    changes.dueDate !== undefined &&
    before.dueDate?.getTime() !== changes.dueDate?.getTime()
  ) {
    await tx
      .delete(taskReminderSentTable)
      .where(eq(taskReminderSentTable.taskId, before.id));
  }
}

export async function publishTaskMutation(
  before: Partial<TaskBefore>,
  after: Pick<TaskBefore, "id" | "projectId" | "title"> & Partial<TaskBefore>,
  userId?: string,
  options: {
    skipSubtaskParentRefresh?: boolean;
    skipRelationRefresh?: boolean;
    fields?: Array<keyof Changes>;
    assigneeName?: string | null;
  } = {},
) {
  const changed = (field: keyof Changes) =>
    (!options.fields || options.fields.includes(field)) &&
    before[field] !== after[field];
  const common = {
    taskId: after.id,
    projectId: after.projectId,
    userId,
    title: after.title,
  };
  if (changed("status")) {
    await publishEvent("task.status_changed", {
      ...common,
      oldStatus: before.status,
      newStatus: after.status,
      assigneeId: after.userId,
      type: "status_changed",
      ...(options.skipSubtaskParentRefresh
        ? { skipSubtaskParentRefresh: true }
        : {}),
    });
  }
  const columnChanged =
    (!options.fields || options.fields.includes("status")) &&
    before.columnId !== undefined &&
    after.columnId !== undefined &&
    before.columnId !== after.columnId;
  if (columnChanged && !changed("status") && !options.skipSubtaskParentRefresh)
    await publishEvent("subtask-parents.refresh", {
      projects: await getSubtaskParentProjects([after.id]),
    });
  if (!options.skipRelationRefresh && (changed("status") || columnChanged))
    await publishEvent("task-relation.refresh", {
      projectId: after.projectId,
      userId,
    });
  if (changed("title"))
    await publishEvent("task.title_changed", {
      ...common,
      oldTitle: before.title,
      newTitle: after.title,
      type: "title_changed",
    });
  if (changed("priority"))
    await publishEvent("task.priority_changed", {
      ...common,
      oldPriority: before.priority,
      newPriority: after.priority,
      type: "priority_changed",
    });
  if (changed("userId")) {
    const assignee =
      options.assigneeName !== undefined
        ? { name: options.assigneeName ?? undefined }
        : after.userId
          ? (
              await db
                .select({ name: userTable.name })
                .from(userTable)
                .where(eq(userTable.id, after.userId))
                .limit(1)
            )[0]
          : undefined;
    await publishEvent(
      after.userId ? "task.assignee_changed" : "task.unassigned",
      {
        ...common,
        oldAssignee: before.userId,
        newAssignee: assignee?.name,
        newAssigneeId: after.userId,
        type: after.userId ? "assignee_changed" : "unassigned",
      },
    );
  }
  if (
    (!options.fields || options.fields.includes("dueDate")) &&
    before.dueDate?.getTime() !== after.dueDate?.getTime()
  )
    await publishEvent("task.due_date_changed", {
      ...common,
      oldDueDate: before.dueDate,
      newDueDate: after.dueDate,
      type: "due_date_changed",
    });
  if (
    (!options.fields || options.fields.includes("description")) &&
    before.description !== undefined &&
    before.description !== after.description
  ) {
    await publishEvent("task.description_changed", {
      ...common,
      oldDescription: before.description,
      newDescription: after.description,
      type: "description_changed",
    });
    deleteOrphanedAssets(before.description, after.description, {
      taskId: after.id,
    }).catch(() => {});
    const oldMentions = new Set(parseMentionIds(before.description));
    const newlyMentioned = parseMentionIds(after.description).filter(
      (id) => id !== userId && !oldMentions.has(id),
    );
    if (newlyMentioned.length) {
      const editor = userId
        ? (
            await db
              .select({ name: userTable.name })
              .from(userTable)
              .where(eq(userTable.id, userId))
              .limit(1)
          )[0]
        : undefined;
      for (const mentionedId of newlyMentioned)
        await createNotification({
          userId: mentionedId,
          type: "task_mention",
          eventData: {
            taskTitle: after.title,
            mentionerName: editor?.name ?? null,
          },
          resourceId: after.id,
          resourceType: "task",
        });
    }
  }
}
