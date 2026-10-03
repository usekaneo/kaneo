import { and, eq, sql } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import type { PluginContext, TaskCreatedEvent } from "../types";
import { canSyncTask } from "./eligibility";

// Keep one lease per API process so provider callbacks can use the pool without
// exhausting it. PostgreSQL also serializes the same task across API instances.
let creationQueue: Promise<void> = Promise.resolve();

export async function withTaskSyncCreation(
  event: TaskCreatedEvent,
  context: PluginContext,
  create: (current: TaskCreatedEvent) => Promise<void>,
) {
  const next = creationQueue.then(() =>
    createWithLease(event, context, create),
  );
  creationQueue = next.catch(() => {});
  await next;
}
async function createWithLease(
  event: TaskCreatedEvent,
  context: PluginContext,
  create: (current: TaskCreatedEvent) => Promise<void>,
) {
  await db.transaction(async (tx) => {
    const result = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(hashtextextended(${`sync-create:${context.integrationId}:${event.taskId}`}, 0)) as locked`,
    );
    if (!result.rows[0]?.locked) return;
    if (
      !(await canSyncTask(
        event.taskId,
        context.integrationId,
        undefined,
        JSON.stringify(context.config),
      ))
    )
      return;
    if (
      await db.query.externalLinkTable.findFirst({
        where: and(
          eq(externalLinkTable.taskId, event.taskId),
          eq(externalLinkTable.integrationId, context.integrationId),
          eq(externalLinkTable.resourceType, "issue"),
        ),
        columns: { id: true },
      })
    )
      return;
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
  });
}
