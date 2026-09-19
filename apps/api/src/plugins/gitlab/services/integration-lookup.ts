import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GitlabConfig } from "../config";
import { normalizeGitlabBaseUrl, normalizeProjectPath } from "../config";

export async function findAllIntegrationsByGitlabProject(
  baseUrl: string,
  projectPath: string,
  integrationId?: string,
) {
  const normalizedBase = normalizeGitlabBaseUrl(baseUrl);
  const normalizedPath = normalizeProjectPath(projectPath);
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
        normalizeGitlabBaseUrl(config.baseUrl) === normalizedBase &&
        normalizeProjectPath(config.projectPath) === normalizedPath;
      if (integrationId && !matches) {
        console.warn("[GitLab Webhook] Signed integration project mismatch", {
          integrationId,
        });
      }
      return matches;
    } catch {
      return false;
    }
  });
}
