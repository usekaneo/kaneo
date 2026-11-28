import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import type { TangledConfig } from "../../plugins/tangled/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

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
    webhookUrl: `${normalizeApiServerUrl(process.env.KANEO_API_URL || "http://localhost:1337").replace(/\/$/, "")}/tangled-integration/webhook/${encodeURIComponent(integration.id)}`,
    baseUrl: config.origin,
    repositoryId: config.repositoryFullName,
    repositoryDid: config.repositoryDid,
    repositoryUrl: config.repositoryUrl,
    branchPattern: config.branchPattern,
    isActive: integration.isActive ?? config.active,
    hasSecret: Boolean(config.webhookSecret),
  };
}
