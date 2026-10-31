import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { TangledConfig } from "../../plugins/tangled/config";

export async function getTangledIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "tangled"),
    ),
  });
  if (!integration) return null;

  const config = JSON.parse(integration.config) as TangledConfig;
  return {
    integrationId: integration.id,
    baseUrl: config.origin,
    repositoryId: config.repositoryFullName,
    repositoryDid: config.repositoryDid,
    repositoryUrl: config.repositoryUrl,
    branchPattern: config.branchPattern,
    isActive: integration.isActive ?? config.active,
    hasSecret: Boolean(config.webhookSecret),
  };
}
