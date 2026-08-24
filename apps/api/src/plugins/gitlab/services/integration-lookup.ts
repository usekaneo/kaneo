import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl } from "../config";

export async function findAllIntegrationsByGitlabProject(
  baseUrl: string,
  repositoryPath: string,
  integrationId?: string,
) {
  const normalized = normalizeGitlabBaseUrl(baseUrl);
  const conditions = [
    eq(integrationTable.type, "gitlab"),
    eq(integrationTable.isActive, true),
  ];
  if (integrationId) {
    conditions.push(eq(integrationTable.id, integrationId));
  }

  const integrations = await db.query.integrationTable.findMany({
    where: and(...conditions),
    with: {
      project: true,
    },
  });

  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitlabConfig;
      const matches =
        normalizeGitlabBaseUrl(config.baseUrl) === normalized &&
        config.repositoryPath === repositoryPath;
      if (integrationId && !matches) {
        console.warn(
          "[GitLab Webhook] Signed integration project mismatch",
          { integrationId },
        );
      }
      return matches;
    } catch {
      return false;
    }
  });
}
