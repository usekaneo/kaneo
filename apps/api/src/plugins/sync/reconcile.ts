import { and, asc, eq, gt } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getPlugin } from "../registry";
import { canSyncTask } from "./eligibility";
import { getSyncIntegrations } from "./integrations";

export async function reconcileTaskSync(
  projectId: string,
  taskId: string,
  onlyIntegrationId?: string,
) {
  const integrations = await getSyncIntegrations(projectId, onlyIntegrationId);
  await reconcileTaskWithIntegrations(projectId, taskId, integrations);
}

async function reconcileTaskWithIntegrations(
  projectId: string,
  taskId: string,
  integrations: Awaited<ReturnType<typeof getSyncIntegrations>>,
) {
  if (!integrations.length) return;
  const links = () =>
    db.query.externalLinkTable.findMany({
      where: and(
        eq(externalLinkTable.taskId, taskId),
        eq(externalLinkTable.resourceType, "issue"),
      ),
      columns: { id: true, metadata: true },
      orderBy: (link, { asc }) => [asc(link.id)],
    });
  const before = await links();
  for (const integration of integrations) {
    try {
      const config = integration.parsedConfig;
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
        where: and(
          eq(taskTable.id, taskId),
          eq(taskTable.projectId, projectId),
        ),
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
    } catch {
      console.error("Task sync reconciliation failed", {
        projectId,
        taskId,
        integrationId: integration.id,
      });
    }
  }
  if (JSON.stringify(before) !== JSON.stringify(await links()))
    await publishEvent("task.updated", { projectId, taskId });
}

export async function reconcileProjectSync(
  projectId: string,
  integrationId?: string,
) {
  const integrations = await getSyncIntegrations(projectId, integrationId);
  if (!integrations.length) return;
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
    for (const task of tasks) {
      try {
        await reconcileTaskWithIntegrations(projectId, task.id, integrations);
      } catch {
        console.error("Task sync reconciliation failed", {
          projectId,
          taskId: task.id,
          integrationId,
        });
      }
    }
    cursor = tasks.at(-1)?.id;
  }
}
