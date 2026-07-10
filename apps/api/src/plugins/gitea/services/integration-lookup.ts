import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { integrationTable } from "../../../database/schema";
import type { GiteaConfig } from "../config";
import { normalizeGiteaBaseUrl } from "../config";

export async function findAllIntegrationsByGiteaRepo(
  baseUrl: string,
  owner: string,
  repo: string,
  integrationId?: string,
) {
  const normalized = normalizeGiteaBaseUrl(baseUrl);
  const conditions = [
    eq(integrationTable.type, "gitea"),
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
      const config = JSON.parse(integration.config) as GiteaConfig;
      const matches =
        normalizeGiteaBaseUrl(config.baseUrl) === normalized &&
        config.repositoryOwner === owner &&
        config.repositoryName === repo;
      if (integrationId && !matches) {
        console.warn("[Gitea Webhook] Signed integration repository mismatch", {
          integrationId,
        });
      }
      return matches;
    } catch {
      return false;
    }
  });
}

export function repoOwnerLogin(repo: {
  owner?: { login?: string; username?: string };
}): string {
  return repo.owner?.login ?? repo.owner?.username ?? "";
}
