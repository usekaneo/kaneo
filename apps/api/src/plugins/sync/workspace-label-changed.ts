import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { readSyncRules, syncProviders } from "./rules";

export async function notifySyncWorkspaceLabelChanged(
  workspaceId: string,
  labelId: string,
  { publishProjectUpdates = true }: { publishProjectUpdates?: boolean } = {},
) {
  const integrations = await db
    .select({
      id: integrationTable.id,
      projectId: integrationTable.projectId,
      config: integrationTable.config,
    })
    .from(integrationTable)
    .innerJoin(projectTable, eq(projectTable.id, integrationTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        inArray(integrationTable.type, [...syncProviders]),
      ),
    );
  const projects = new Set<string>();
  for (const integration of integrations) {
    projects.add(integration.projectId);
    const rule = readSyncRules(integration.config)?.outgoing;
    if (rule?.mode === "labels" && rule.labels.includes(labelId))
      await publishEvent("integration.sync_labels_changed", {
        projectId: integration.projectId,
        integrationId: integration.id,
      });
  }
  if (publishProjectUpdates)
    for (const projectId of projects)
      await publishEvent("project.updated", { projectId });
}
