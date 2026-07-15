import { and, between, eq, isNotNull, isNull, or } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  taskReminderSentTable,
  taskTable,
  userNotificationPreferenceTable,
} from "../database/schema";
import createNotification from "../notification/controllers/create-notification";
import { isReminderDue } from "./reminder-timing";

type ReminderType = "configured_before" | "overdue";

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function buildWindows(now: Date) {
  const nowMs = now.getTime();

  return {
    upcoming: {
      start: now,
      end: new Date(nowMs + 30 * 24 * HOUR_MS),
      type: "configured_before" as ReminderType,
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
      leadTimeMinutes:
        userNotificationPreferenceTable.dueDateReminderLeadTimeMinutes,
    })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .leftJoin(
      userNotificationPreferenceTable,
      eq(userNotificationPreferenceTable.userId, taskTable.userId),
    )
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
        or(
          isNull(userNotificationPreferenceTable.id),
          eq(userNotificationPreferenceTable.dueDateReminderEnabled, true),
        ),
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
    leadTimeMinutes: number | null;
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
      leadTimeMinutes: task.leadTimeMinutes ?? 1440,
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
        if (window.type === "configured_before" && task.dueDate) {
          const leadTimeMinutes = task.leadTimeMinutes ?? 1440;
          if (!isReminderDue({ dueDate: task.dueDate, leadTimeMinutes, now })) {
            continue;
          }
        }

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
