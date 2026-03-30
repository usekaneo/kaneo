import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGiteaConfig,
  type GiteaConfig,
} from "../../plugins/gitea/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

async function getGiteaIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitea"),
    ),
  });

  if (!integration) {
    return null;
  }

  const config = JSON.parse(integration.config) as GiteaConfig;

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl,
    repositoryOwner: config.repositoryOwner,
    repositoryName: config.repositoryName,
    maskedAccessToken: maskToken(config.accessToken),
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitea-integration/webhook/${integration.id}`,
    webhookSecret: config.webhookSecret ?? "",
    branchPattern: config.branchPattern || defaultGiteaConfig.branchPattern,
    commentTaskLinkOnGiteaIssue: config.commentTaskLinkOnGiteaIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGiteaIntegration;
