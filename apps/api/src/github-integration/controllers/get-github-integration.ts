import { and, eq } from "drizzle-orm";
import db from "../../database";
import { githubImportTable, integrationTable } from "../../database/schema";
import {
  defaultGitHubConfig,
  type GitHubConfig,
  hasVerifiedGitHubBinding,
} from "../../plugins/github/config";

import { importProgress } from "../import-state";

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

  const run = await db.query.githubImportTable.findFirst({
    where: eq(githubImportTable.integrationId, integration.id),
  });

  return {
    ...(run && run.state.repositoryId === config.repositoryId
      ? { importProgress: importProgress(run.runId, run.state) }
      : {}),
    id: integration.id,
    projectId: integration.projectId,
    repositoryOwner: config.repositoryOwner,
    repositoryName: config.repositoryName,
    installationId: config.installationId,
    branchPattern: config.branchPattern || defaultGitHubConfig.branchPattern,
    commentTaskLinkOnGitHubIssue: config.commentTaskLinkOnGitHubIssue !== false,
    isActive: integration.isActive && hasVerifiedGitHubBinding(config),
    requiresVerification: !hasVerifiedGitHubBinding(config),
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGithubIntegration;
