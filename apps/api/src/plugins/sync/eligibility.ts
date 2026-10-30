import { outgoingPredicate } from "./task-predicate";
import { sameConfig } from "./same-config";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  externalLinkTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { updateExternalLink } from "../github/services/link-manager";
import type { IntegrationDatabase } from "../github/services/integration-task-scope";
import { isSyncPaused, readSyncRules, type LabelRule } from "./rules";

export async function taskMatchesRule(
  taskId: string,
  projectId: string,
  rule: LabelRule,
  database: IntegrationDatabase = db,
): Promise<boolean> {
  const task = await database.query.taskTable.findFirst({
    where: and(eq(taskTable.id, taskId), eq(taskTable.projectId, projectId)),
    columns: { id: true },
  });
  if (!task) return false;
  if (rule.mode === "all") return true;
  const project = await database.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
    columns: { workspaceId: true },
  });
  if (!project) return false;
  const { predicate } = await outgoingPredicate(
    project.workspaceId,
    rule,
    database,
  );
  const [matching] = await database
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(taskTable.projectId, projectId),
        predicate,
      ),
    );
  return !!matching;
}

export async function canSyncTask(
  taskId: string,
  integrationId: string,
  database: IntegrationDatabase = db,
  expectedConfig?: string,
): Promise<boolean> {
  const integration = await database.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });
  if (
    !integration?.isActive ||
    (expectedConfig !== undefined &&
      !sameConfig(integration.config, expectedConfig))
  )
    return false;
  const rules = readSyncRules(integration.config);
  const matches =
    !!rules &&
    (await taskMatchesRule(
      taskId,
      integration.projectId,
      rules.outgoing,
      database,
    ));
  const links = await database.query.externalLinkTable.findMany({
    where: and(
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.taskId, taskId),
      eq(externalLinkTable.resourceType, "issue"),
    ),
  });
  if (!matches) {
    for (const link of links) {
      if (!isSyncPaused(link.metadata))
        await updateExternalLink(
          link.id,
          { metadata: { syncFilterPaused: true } },
          database,
        );
    }
    return false;
  }
  return !links.some((link) => isSyncPaused(link.metadata));
}
