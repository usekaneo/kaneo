import { and, asc, eq, gt, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getPlugin } from "../registry";
import { canSyncTask } from "./eligibility";
import { readSyncRules, syncProviders } from "./rules";

export async function reconcileTaskSync(
  projectId: string,
  taskId: string,
  onlyIntegrationId?: string,
) {
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.isActive, true),
      inArray(integrationTable.type, [...syncProviders]),
      onlyIntegrationId
        ? eq(integrationTable.id, onlyIntegrationId)
        : undefined,
    ),
  });
  for (const integration of integrations) {
    // Legacy integrations retain their existing task-created behavior.
    const config = JSON.parse(integration.config) as Record<string, unknown>;
    if (!config.syncRules || !readSyncRules(config)) continue;
    if (
      !(await canSyncTask(
        taskId,
        integration.id,
        undefined,
        integration.config,
      ))
    )
      continue;
    const plugin = getPlugin(integration.type);
    if (!plugin?.onTaskCreated) continue;
    const task = await db.query.taskTable.findFirst({
      where: and(eq(taskTable.id, taskId), eq(taskTable.projectId, projectId)),
    });
    if (!task || task.number === null) continue;
    await plugin.onTaskCreated(
      {
        taskId: task.id,
        projectId,
        userId: task.userId ?? "",
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        number: task.number,
      },
      { integrationId: integration.id, projectId, config },
    );
  }
  await publishEvent("task.updated", { projectId, taskId });
}

export async function reconcileProjectSync(
  projectId: string,
  integrationId?: string,
) {
  let cursor: string | undefined;
  for (;;) {
    const tasks = await db
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, projectId),
          cursor ? gt(taskTable.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(taskTable.id))
      .limit(50);
    if (!tasks.length) return;
    for (const task of tasks)
      await reconcileTaskSync(projectId, task.id, integrationId);
    cursor = tasks.at(-1)?.id;
  }
}
