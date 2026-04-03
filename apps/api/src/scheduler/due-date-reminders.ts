import { and, between, eq, isNotNull, isNull, or } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  taskReminderSentTable,
  taskTable,
} from "../database/schema";
import createNotification from "../notification/controllers/create-notification";

type ReminderType = "one_day_before" | "one_hour_before" | "overdue";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function buildWindows(now: Date) {
  const nowMs = now.getTime();

  return {
    oneDay: {
      start: new Date(nowMs + 23 * HOUR_MS + 50 * MINUTE_MS),
      end: new Date(nowMs + 24 * HOUR_MS + 10 * MINUTE_MS),
      type: "one_day_before" as ReminderType,
      notificationType: "due_date_reminder" as const,
    },
    oneHour: {
      start: new Date(nowMs + 50 * MINUTE_MS),
      end: new Date(nowMs + 70 * MINUTE_MS),
      type: "one_hour_before" as ReminderType,
      notificationType: "due_date_reminder" as const,
    },
    overdue: {
      end: now,
      start: new Date(nowMs - 10 * MINUTE_MS),
      type: "overdue" as ReminderType,
      notificationType: "task_overdue" as const,
    },
  };
}

async function getTasksNeedingReminder(
  windowStart: Date,
  windowEnd: Date,
  reminderType: ReminderType,
) {
  const results = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .leftJoin(
      taskReminderSentTable,
      and(
        eq(taskReminderSentTable.taskId, taskTable.id),
        eq(taskReminderSentTable.reminderType, reminderType),
      ),
    )
    .where(
      and(
        isNotNull(taskTable.userId),
        isNotNull(taskTable.dueDate),
        between(taskTable.dueDate, windowStart, windowEnd),
        isNull(taskReminderSentTable.id),
        // Exclude tasks in final columns (completed); include tasks with no column
        or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
      ),
    );

  return results;
}

async function processReminder(
  task: {
    id: string;
    title: string;
    userId: string | null;
    dueDate: Date | null;
    projectId: string;
  },
  reminderType: ReminderType,
  notificationType: "due_date_reminder" | "task_overdue",
) {
  if (!task.userId) return;

  // Insert sent record first — if it already exists, skip notification
  try {
    const [inserted] = await db
      .insert(taskReminderSentTable)
      .values({
        taskId: task.id,
        reminderType,
      })
      .onConflictDoNothing({
        target: [
          taskReminderSentTable.taskId,
          taskReminderSentTable.reminderType,
        ],
      })
      .returning();

    if (!inserted) return;
  } catch {
    return;
  }

  await createNotification({
    userId: task.userId,
    type: notificationType,
    eventData: {
      taskTitle: task.title,
      reminderType,
      dueDate: task.dueDate?.toISOString() ?? null,
    },
    resourceId: task.id,
    resourceType: "task",
  });
}

export async function checkDueDateReminders(): Promise<void> {
  const now = new Date();
  const windows = buildWindows(now);

  for (const window of Object.values(windows)) {
    try {
      const tasks = await getTasksNeedingReminder(
        window.start,
        window.end,
        window.type,
      );

      for (const task of tasks) {
        try {
          await processReminder(task, window.type, window.notificationType);
        } catch (error) {
          console.error("Failed to process due date reminder", {
            taskId: task.id,
            reminderType: window.type,
            error,
          });
        }
      }
    } catch (error) {
      console.error("Failed to query tasks for due date reminders", {
        reminderType: window.type,
        error,
      });
    }
  }
}
