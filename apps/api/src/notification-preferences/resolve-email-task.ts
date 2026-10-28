import type { NotificationEmailTask } from "@kaneo/email";
import { and, asc, count, eq, isNull } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../database/schema";
import {
  getInitials,
  resolveColumnIcon,
  resolveDueStatus,
  resolveLabelColor,
  resolvePriority,
} from "./email-task-format";

async function findColumn(task: {
  columnId: string | null;
  projectId: string;
  status: string;
}) {
  const [column] = await db
    .select({
      id: columnTable.id,
      name: columnTable.name,
      slug: columnTable.slug,
      icon: columnTable.icon,
      isFinal: columnTable.isFinal,
    })
    .from(columnTable)
    .where(
      task.columnId
        ? eq(columnTable.id, task.columnId)
        : and(
            eq(columnTable.projectId, task.projectId),
            eq(columnTable.slug, task.status),
          ),
    )
    .limit(1);

  return column;
}

export async function resolveEmailTask(
  taskId: string,
): Promise<NotificationEmailTask | undefined> {
  const [task] = await db
    .select({
      number: taskTable.number,
      title: taskTable.title,
      priority: taskTable.priority,
      dueDate: taskTable.dueDate,
      status: taskTable.status,
      columnId: taskTable.columnId,
      projectId: taskTable.projectId,
      projectSlug: projectTable.slug,
      assigneeName: userTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(eq(taskTable.id, taskId))
    .limit(1);

  if (!task) {
    return undefined;
  }

  const [column, labels] = await Promise.all([
    findColumn(task),
    db
      .select({ name: labelTable.name, color: labelTable.color })
      .from(labelTable)
      .where(
        and(
          eq(labelTable.taskId, taskId),
          isNull(labelTable.deletionStartedAt),
        ),
      )
      .orderBy(asc(labelTable.createdAt)),
  ]);

  const [columnCount] = column
    ? await db
        .select({ value: count() })
        .from(taskTable)
        .where(
          and(
            eq(taskTable.projectId, task.projectId),
            eq(taskTable.status, column.slug),
          ),
        )
    : [];

  return {
    ticket: `${task.projectSlug}-${task.number}`,
    title: task.title,
    labels: labels.map((label) => ({
      name: label.name,
      color: resolveLabelColor(label.color),
    })),
    priority: resolvePriority(task.priority),
    dueDate: task.dueDate ?? undefined,
    dueStatus: task.dueDate
      ? resolveDueStatus(task.dueDate, column?.isFinal ?? false)
      : undefined,
    assigneeInitials: getInitials(task.assigneeName),
    column: column
      ? {
          name: column.name,
          icon: resolveColumnIcon(column),
          count: columnCount?.value,
        }
      : undefined,
  };
}
