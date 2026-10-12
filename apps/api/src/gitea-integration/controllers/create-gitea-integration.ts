import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import { assertRepositoryBindingQuota } from "../../plan-limits/repository-binding-quota";
import {
  type GiteaConfig,
  getDefaultGiteaConfig,
  normalizeGiteaBaseUrl,
  validateGiteaConfig,
} from "../../plugins/gitea/config";
import {
  createGiteaClient,
  GiteaApiError,
  verifyGiteaToken,
} from "../../plugins/gitea/utils/gitea-api";

import { resolveVerificationToken } from "./resolve-verification-token";

// RFC 0001 WP3: one integration row per Gitea repository. The update-in-place
// branch (reusing the single row and its webhook secret) and the O(n)
// cross-project `allGitea` JSON scan are deleted with nothing replacing
// them: per governing decision D1 cross-project links are valid rows, and
// same-project duplicates are decided by the per-project unique constraint
// (integration_project_type_repo_unique), which also closes the concurrency
// race the in-memory scan left open. Each binding gets its own fresh
// webhookSecret; the per-integration webhook route carries it.

/**
 * Repository identity key: `gitea:<normalized baseUrl>/<owner>/<name>`,
 * lowercased owner and name (RFC 0001 section 4.1).
 */
export function giteaRepositoryKey(
  baseUrl: string,
  repositoryOwner: string,
  repositoryName: string,
): string {
  return `gitea:${baseUrl}/${repositoryOwner.toLowerCase()}/${repositoryName.toLowerCase()}`;
}

async function createGiteaIntegration({
  projectId,
  baseUrl,
  accessToken,
  repositoryOwner,
  repositoryName,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  repositoryOwner: string;
  repositoryName: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = normalizeGiteaBaseUrl(baseUrl);

  const resolvedToken = await resolveVerificationToken({
    projectId,
    baseUrl: normalizedBase,
    accessToken,
  });

  try {
    await verifyGiteaToken(normalizedBase, resolvedToken);

    const client = createGiteaClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
    });
    await client.getRepo(repositoryOwner, repositoryName);
  } catch (error) {
    if (error instanceof GiteaApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  // WP10: enforce the per-project repository binding quota after repository
  // verification and before the insert. 402 propagates unchanged.
  await assertRepositoryBindingQuota(projectId, project.workspaceId);

  const webhookSecret = randomBytes(24).toString("hex");

  const config: GiteaConfig = getDefaultGiteaConfig(
    normalizedBase,
    resolvedToken,
    repositoryOwner,
    repositoryName,
    webhookSecret,
  );

  const validation = await validateGiteaConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  try {
    const [newIntegration] = await db
      .insert(integrationTable)
      .values({
        projectId,
        type: "gitea",
        config: JSON.stringify(config),
        repositoryKey: giteaRepositoryKey(
          normalizedBase,
          repositoryOwner,
          repositoryName,
        ),
        repositoryOwner,
        repositoryName,
        baseUrl: normalizedBase,
        isActive: true,
      })
      .returning();

    if (!newIntegration) {
      throw new HTTPException(500, {
        message: "Failed to create Gitea integration",
      });
    }

    return {
      id: newIntegration.id,
      projectId: newIntegration.projectId,
      baseUrl: normalizedBase,
      repositoryOwner,
      repositoryName,
      webhookSecret,
      isActive: newIntegration.isActive,
      createdAt: newIntegration.createdAt,
      updatedAt: newIntegration.updatedAt,
    };
  } catch (error) {
    mapIntegrationUniqueViolation(error, { projectId, type: "gitea" });
  }
}

export default createGiteaIntegration;
