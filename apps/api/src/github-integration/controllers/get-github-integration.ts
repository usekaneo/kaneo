import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGitHubConfig,
  type GitHubConfig,
} from "../../plugins/github/config";

async function getGithubIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  if (!integration) {
    return null;
  }

  const config = JSON.parse(integration.config) as GitHubConfig;
  const authMode = config.accessToken ? "token" : "app";

  // Surface what the UI needs to finish per-project (token) setup — the webhook
  // endpoint and its secret — but never the access token itself.
  const apiUrl = process.env.KANEO_API_URL || "http://localhost:1337";
  const webhookUrl =
    authMode === "token"
      ? `${apiUrl.replace(/\/$/, "")}/github-integration/webhook`
      : undefined;

  return {
    id: integration.id,
    projectId: integration.projectId,
    repositoryOwner: config.repositoryOwner,
    repositoryName: config.repositoryName,
    installationId: config.installationId,
    authMode,
    hasAccessToken: authMode === "token",
    webhookUrl,
    webhookSecret: authMode === "token" ? config.webhookSecret : undefined,
    branchPattern: config.branchPattern || defaultGitHubConfig.branchPattern,
    commentTaskLinkOnGitHubIssue: config.commentTaskLinkOnGitHubIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGithubIntegration;
