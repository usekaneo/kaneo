import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGitlabConfig,
  type GitlabConfig,
  projectFullPath,
} from "../../plugins/gitlab/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

function maskToken(token: unknown): string {
  if (typeof token !== "string" || token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

async function getGitlabIntegration(
  projectId: string,
  includeWebhookSecret = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    return null;
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch (error) {
    console.error("Invalid GitLab integration config JSON", {
      integrationId: integration.id,
      error,
    });
    return null;
  }

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl,
    namespace: config.namespace,
    projectPath: config.projectPath,
    fullPath: projectFullPath(config),
    tokenType: config.tokenType ?? ("pat" as const),
    maskedAccessToken: maskToken(config.accessToken),
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitlab-integration/webhook/${integration.id}`,
    webhookSecret: includeWebhookSecret ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultGitlabConfig.branchPattern,
    commentTaskLinkOnGitlabIssue: config.commentTaskLinkOnGitlabIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGitlabIntegration;
