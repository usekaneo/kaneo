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

  return {
    id: integration.id,
    projectId: integration.projectId,
    repositoryOwner: config.repositoryOwner,
    repositoryName: config.repositoryName,
    installationId: config.installationId,
    branchPattern: config.branchPattern || defaultGitHubConfig.branchPattern,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

export default getGithubIntegration;
