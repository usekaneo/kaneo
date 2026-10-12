import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGitlabConfig,
  type GitlabConfig,
} from "../../plugins/gitlab/config";
import { tokenTypeOf } from "../../plugins/gitlab/utils/gitlab-api";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

type IntegrationRow = typeof integrationTable.$inferSelect;

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

// RFC 0001 WP4: the GitLab surface is keyed by integration id. Tokens are
// masked; the webhook secret and masked token are included only for callers
// with workspace:manage_settings -- per row now, so each project owner sees
// only their own binding's secret.
function enrichGitlabIntegration(
  integration: IntegrationRow,
  includeSecrets = false,
) {
  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch {
    config = {} as GitlabConfig;
  }

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl ?? integration.baseUrl ?? "",
    projectPath: config.projectPath ?? "",
    tokenType: tokenTypeOf(config),
    maskedAccessToken:
      includeSecrets && config.accessToken ? maskToken(config.accessToken) : "",
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitlab-integration/webhook/${integration.id}`,
    webhookSecret: includeSecrets ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultGitlabConfig.branchPattern,
    commentTaskLinkOnGitlabIssue: config.commentTaskLinkOnGitlabIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

/** List every GitLab binding of a project, oldest first. */
async function listGitlabIntegrations(
  projectId: string,
  includeSecrets = false,
) {
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  return integrations.map((integration) =>
    enrichGitlabIntegration(integration, includeSecrets),
  );
}

/** Single lookup by primary key (id-keyed routes). */
async function getGitlabIntegrationById(
  integrationId: string,
  includeSecrets = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });
  if (!integration) {
    return null;
  }
  return enrichGitlabIntegration(integration, includeSecrets);
}

/**
 * Compat shim (RFC section 8): the old project-keyed GET returns the first
 * binding (lowest createdAt) until the new web client ships; removed in the
 * cleanup PR.
 */
async function getGitlabIntegration(
  projectId: string,
  includeSecrets = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  if (!integration) {
    return null;
  }
  return enrichGitlabIntegration(integration, includeSecrets);
}

export default getGitlabIntegration;
export {
  getGitlabIntegration,
  getGitlabIntegrationById,
  listGitlabIntegrations,
};
