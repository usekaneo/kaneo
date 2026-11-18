import { and, eq } from "drizzle-orm";
import db from "../../database";
import { githubImportTable, integrationTable } from "../../database/schema";
import {
  defaultGitHubConfig,
  type GitHubConfig,
  hasVerifiedGitHubBinding,
} from "../../plugins/github/config";

import { importProgress } from "../import-state";

type IntegrationRow = typeof integrationTable.$inferSelect;

// RFC 0001 WP2: the GitHub surface is keyed by integration id. Every row is
// enriched with its verification state (legacy bindings without a verified
// numeric repository id expose `requiresVerification`) and its import
// progress when a github_import run exists for the binding.
function enrichGithubIntegration(integration: IntegrationRow) {
  let config: GitHubConfig;
  try {
    config = JSON.parse(integration.config) as GitHubConfig;
  } catch {
    config = { repositoryOwner: "", repositoryName: "" } as GitHubConfig;
  }

  return {
    id: integration.id,
    projectId: integration.projectId,
    repositoryOwner:
      integration.repositoryOwner ?? config.repositoryOwner ?? "",
    repositoryName: integration.repositoryName ?? config.repositoryName ?? "",
    installationId: config.installationId ?? null,
    branchPattern: config.branchPattern || defaultGitHubConfig.branchPattern,
    commentTaskLinkOnGitHubIssue: config.commentTaskLinkOnGitHubIssue !== false,
    isActive: integration.isActive && hasVerifiedGitHubBinding(config),
    requiresVerification: !hasVerifiedGitHubBinding(config),
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

async function withImportProgress(integration: IntegrationRow) {
  let config: GitHubConfig | null = null;
  try {
    config = JSON.parse(integration.config) as GitHubConfig;
  } catch {
    config = null;
  }
  const run = config
    ? await db.query.githubImportTable.findFirst({
        where: eq(githubImportTable.integrationId, integration.id),
      })
    : null;
  return {
    ...(run && config && run.state.repositoryId === config.repositoryId
      ? { importProgress: importProgress(run.runId, run.state) }
      : {}),
    ...enrichGithubIntegration(integration),
  };
}

/** List every GitHub binding of a project, oldest first. */
async function listGithubIntegrations(projectId: string) {
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  return Promise.all(integrations.map(withImportProgress));
}

/** Single lookup by primary key (id-keyed routes). */
async function getGithubIntegrationById(integrationId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });
  if (!integration) {
    return null;
  }
  return withImportProgress(integration);
}

/**
 * Compat shim (RFC section 8): the old project-keyed GET returns the first
 * binding (lowest createdAt) until the new web client ships; removed in the
 * cleanup PR.
 */
async function getGithubIntegration(projectId: string) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  if (!integration) {
    return null;
  }
  return withImportProgress(integration);
}

export default getGithubIntegration;
export {
  getGithubIntegration,
  getGithubIntegrationById,
  listGithubIntegrations,
};
