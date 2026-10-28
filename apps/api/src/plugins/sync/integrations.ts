import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { readSyncRules, syncProviders } from "./rules";
import { activeIntegrationCondition } from "../active-integration-condition";

export async function getSyncIntegrations(
  projectId: string,
  integrationId?: string,
) {
  const rows = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      activeIntegrationCondition(),
      inArray(integrationTable.type, [...syncProviders]),
      integrationId ? eq(integrationTable.id, integrationId) : undefined,
    ),
  });
  return rows.flatMap((integration) => {
    try {
      const config = JSON.parse(integration.config) as Record<string, unknown>;
      // Legacy integrations retain their existing task-created behavior.
      return config.syncRules && readSyncRules(config)
        ? [{ ...integration, parsedConfig: config }]
        : [];
    } catch {
      return [];
    }
  });
}
