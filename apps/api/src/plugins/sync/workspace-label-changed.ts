import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { readSyncRules, syncProviders } from "./rules";

export async function notifySyncWorkspaceLabelChanged(
  workspaceId: string,
  labelId: string,
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
        eq(integrationTable.isActive, true),
        inArray(integrationTable.type, [...syncProviders]),
      ),
    );
  for (const integration of integrations) {
    const rule = readSyncRules(integration.config)?.outgoing;
    if (rule?.mode === "labels" && rule.labels.includes(labelId))
      await publishEvent("integration.sync_labels_changed", {
        projectId: integration.projectId,
        integrationId: integration.id,
      });
  }
}
