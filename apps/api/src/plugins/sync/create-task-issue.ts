import { and, eq } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { PluginContext, TaskCreatedEvent } from "../types";
import { canSyncTask } from "./eligibility";
import { isIssueInitializationPending } from "./initialize-task-issue";
import { withSyncLease } from "./lease";

export async function withTaskSyncCreation(
  event: TaskCreatedEvent,
  context: PluginContext,
  create: (current: TaskCreatedEvent) => Promise<void>,
) {
  await withSyncLease(
    `sync-create:${context.integrationId}:${event.taskId}`,
    () => createWithLease(event, context, create),
  );
}
async function createWithLease(
  event: TaskCreatedEvent,
  context: PluginContext,
  create: (current: TaskCreatedEvent) => Promise<void>,
) {
  if (
    !(await canSyncTask(
      event.taskId,
      context.integrationId,
      undefined,
      JSON.stringify(context.config),
    ))
  )
    return;
  const link = await db.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.taskId, event.taskId),
      eq(externalLinkTable.integrationId, context.integrationId),
      eq(externalLinkTable.resourceType, "issue"),
    ),
  });
  if (link && !isIssueInitializationPending(link)) return;
  const task = await db.query.taskTable.findFirst({
    where: and(
      eq(taskTable.id, event.taskId),
      eq(taskTable.projectId, context.projectId),
    ),
  });
  if (!task || task.number === null) return;
  await create({
    taskId: task.id,
    projectId: task.projectId,
    userId: task.userId ?? "",
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    number: task.number,
  });
  await canSyncTask(task.id, context.integrationId);
}
