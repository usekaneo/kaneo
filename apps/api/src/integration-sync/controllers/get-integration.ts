import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import { readSyncRules } from "../../plugins/sync/rules";
import type { IntegrationDatabase } from "../../plugins/github/services/integration-task-scope";

export async function getSyncIntegration(
  projectId: string,
  provider: string,
  database: IntegrationDatabase = db,
) {
  const integration = await database.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, provider),
    ),
    with: { project: true },
  });
  if (!integration)
    throw new HTTPException(404, { message: "Integration not found" });
  if (!readSyncRules(integration.config))
    throw new HTTPException(409, {
      message: "Invalid sync rules; repair the integration configuration",
    });
  return integration;
}
