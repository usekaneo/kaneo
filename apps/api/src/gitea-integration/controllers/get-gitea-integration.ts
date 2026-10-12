import { and, eq } from "drizzle-orm";
import db from "../../database";
import { integrationTable } from "../../database/schema";
import {
  defaultGiteaConfig,
  type GiteaConfig,
} from "../../plugins/gitea/config";
import { normalizeApiServerUrl } from "../../utils/openapi-spec";

type IntegrationRow = typeof integrationTable.$inferSelect;

function maskToken(token: string): string {
  if (token.length <= 8) {
    return "••••••••";
  }
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

// RFC 0001 WP3: the Gitea surface is keyed by integration id. Every row is
// enriched with its detail shape; there is no verification equivalent to the
// GitHub numeric repository id, so the row's isActive drives the status chip.
// The webhook secret is only included for callers with
// workspace:manage_settings, exactly as before -- per row now, so each
// project owner sees only their own binding's secret.
function enrichGiteaIntegration(
  integration: IntegrationRow,
  includeWebhookSecret = false,
) {
  let config: GiteaConfig;
  try {
    config = JSON.parse(integration.config) as GiteaConfig;
  } catch {
    config = {} as GiteaConfig;
  }

  const apiBase = normalizeApiServerUrl(
    process.env.KANEO_API_URL || "http://localhost:1337",
  );

  return {
    id: integration.id,
    projectId: integration.projectId,
    baseUrl: config.baseUrl ?? integration.baseUrl ?? "",
    repositoryOwner:
      integration.repositoryOwner ?? config.repositoryOwner ?? "",
    repositoryName: integration.repositoryName ?? config.repositoryName ?? "",
    maskedAccessToken: config.accessToken
      ? maskToken(config.accessToken)
      : "",
    webhookUrl: `${apiBase.replace(/\/$/, "")}/gitea-integration/webhook/${integration.id}`,
    webhookSecret: includeWebhookSecret ? (config.webhookSecret ?? "") : "",
    branchPattern: config.branchPattern || defaultGiteaConfig.branchPattern,
    commentTaskLinkOnGiteaIssue: config.commentTaskLinkOnGiteaIssue !== false,
    isActive: integration.isActive,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}

/** List every Gitea binding of a project, oldest first. */
async function listGiteaIntegrations(
  projectId: string,
  includeWebhookSecret = false,
) {
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitea"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  return integrations.map((integration) =>
    enrichGiteaIntegration(integration, includeWebhookSecret),
  );
}

/** Single lookup by primary key (id-keyed routes). */
async function getGiteaIntegrationById(
  integrationId: string,
  includeWebhookSecret = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
  });
  if (!integration) {
    return null;
  }
  return enrichGiteaIntegration(integration, includeWebhookSecret);
}

/**
 * Compat shim (RFC section 8): the old project-keyed GET returns the first
 * binding (lowest createdAt) until the new web client ships; removed in the
 * cleanup PR.
 */
async function getGiteaIntegration(
  projectId: string,
  includeWebhookSecret = false,
) {
  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitea"),
    ),
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
  if (!integration) {
    return null;
  }
  return enrichGiteaIntegration(integration, includeWebhookSecret);
}

export default getGiteaIntegration;
export {
  getGiteaIntegration,
  getGiteaIntegrationById,
  listGiteaIntegrations,
};
