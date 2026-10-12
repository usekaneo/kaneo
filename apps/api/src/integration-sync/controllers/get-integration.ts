import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { readSyncRules } from "../../plugins/sync/rules";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";

// RFC 0001 WP5: the sync surface resolves its binding by integration id. No
// lookup on (projectId, provider) remains on the primary path; the
// project-keyed compat shim below resolves the first binding only.

function assertSyncRules(integration: {
  config: string;
}) {
  if (!readSyncRules(integration.config))
    throw new HTTPException(409, {
      message: "Invalid sync rules; repair the integration configuration",
    });
  return integration;
}

export async function getSyncIntegration(
  integrationId: string,
  database: IntegrationDatabase = db,
) {
  const integration = await database.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
    with: { project: true },
  });
  if (!integration)
    throw new HTTPException(404, { message: "Integration not found" });
  return assertSyncRules(integration);
}

/**
 * Compat shim (RFC section 8): the old project-keyed routes resolve the
 * project's first binding for the provider (lowest createdAt) until the new
 * web client ships; removed in the cleanup PR.
 */
export async function getSyncIntegrationByProject(
  projectId: string,
  provider: string,
  database: IntegrationDatabase = db,
) {
  const integration = await database.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, provider),
    ),
    orderBy: (table, { asc: ascending }) => [ascending(table.createdAt)],
    with: { project: true },
  });
  if (!integration)
    throw new HTTPException(404, { message: "Integration not found" });
  return assertSyncRules(integration);
}
