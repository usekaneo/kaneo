import { and, asc, eq, gt } from "drizzle-orm";
import db from "../../database";
import {
  externalLinkTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { getPlugin } from "../registry";
import { canSyncTask } from "./eligibility";
import { getSyncIntegrations } from "./integrations";
import { readSyncRules } from "./rules";
import { outgoingPredicate } from "./task-predicate";
import { reconciliationPredicate } from "./reconciliation-predicate";

export async function reconcileTaskSync(
  projectId: string,
  taskId: string,
  onlyIntegrationId?: string,
) {
  const integrations = await getSyncIntegrations(projectId, onlyIntegrationId);
  if (await reconcileTaskWithIntegrations(projectId, taskId, integrations))
    await publishEvent("project.updated", { projectId });
}

async function reconcileTaskWithIntegrations(
  projectId: string,
  taskId: string,
  integrations: Awaited<ReturnType<typeof getSyncIntegrations>>,
) {
  if (!integrations.length) return false;
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
  if (JSON.stringify(before) !== JSON.stringify(await links())) {
    await publishEvent("task.updated", { projectId, taskId });
    return true;
  }
  return false;
}

export async function reconcileProjectSync(
  projectId: string,
  integrationId?: string,
) {
  const integrations = await getSyncIntegrations(projectId, integrationId);
  if (!integrations.length) return;
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
    columns: { workspaceId: true },
  });
  if (!project) return;
  let changed = false;
  try {
    for (const integration of integrations) {
      const scope = await outgoingPredicate(
        project.workspaceId,
        readSyncRules(integration.config)!.outgoing,
      );
      let cursor: string | undefined;
      for (;;) {
        const tasks = await db
          .select({ id: taskTable.id })
          .from(taskTable)
          .where(
            and(
              eq(taskTable.projectId, projectId),
              reconciliationPredicate(integration.id, scope.predicate),
              cursor ? gt(taskTable.id, cursor) : undefined,
            ),
          )
          .orderBy(asc(taskTable.id))
          .limit(50);
        if (!tasks.length) break;
        for (const task of tasks) {
          try {
            if (
              await reconcileTaskWithIntegrations(projectId, task.id, [
                integration,
              ])
            )
              changed = true;
          } catch {
            console.error("Task sync reconciliation failed", {
              projectId,
              taskId: task.id,
              integrationId: integration.id,
            });
          }
        }
        cursor = tasks.at(-1)?.id;
      }
    }
  } finally {
    if (changed) await publishEvent("project.updated", { projectId });
  }
}
