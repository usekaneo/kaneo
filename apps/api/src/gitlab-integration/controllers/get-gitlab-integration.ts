import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGitlabConfig,
  type GitlabConfig,
} from "../../plugins/gitlab/config";
import { tokenTypeOf } from "../../plugins/gitlab/utils/gitlab-api";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

async function getGitlabIntegration(projectId: string, includeSecrets = false) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    return null;
  }

  const config = JSON.parse(integration.config) as GitlabConfig;

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl,
    projectPath: config.projectPath,
    tokenType: tokenTypeOf(config),
    maskedAccessToken: includeSecrets ? maskToken(config.accessToken) : "",
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitlab-integration/webhook/${integration.id}`,
    webhookSecret: includeSecrets ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultGitlabConfig.branchPattern,
    commentTaskLinkOnGitlabIssue: config.commentTaskLinkOnGitlabIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGitlabIntegration;
