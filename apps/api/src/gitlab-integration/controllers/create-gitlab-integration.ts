import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import { assertRepositoryBindingQuota } from "../../plan-limits/repository-binding-quota";
import {
  type GitlabConfig,
  type GitlabTokenType,
  getDefaultGitlabConfig,
  normalizeGitlabBaseUrl,
  validateGitlabConfig,
} from "../../plugins/gitlab/config";
import {
  createGitlabClient,
  GitlabApiError,
  verifyGitlabToken,
} from "../../plugins/gitlab/utils/gitlab-api";
import {
  parseGitlabBaseUrl,
  parseGitlabProjectPath,
} from "../utils/normalize-input";

// RFC 0001 WP4: one integration row per GitLab project. The update-in-place
// branch (reusing the single row) and the O(n) cross-project `allGitlab` JSON
// scan are deleted with nothing replacing them: per governing decision D1
// cross-project links are valid rows, and same-project duplicates are decided
// by the per-project unique constraint (integration_project_type_repo_unique),
// which also closes the concurrency race the in-memory scan left open. Each
// binding gets its own fresh webhookSecret; the per-integration webhook
// route carries it.

/**
 * Repository identity key: `gitlab:<normalized baseUrl>/<projectPath>`, full
 * path lowercased (RFC 0001 section 4.1). Byte-identical to the WP0 SQL
 * backfill, which lowercases the full project path and concatenates the
 * stored (already normalized) base URL.
 */
export function gitlabRepositoryKey(
  baseUrl: string,
  projectPath: string,
): string {
  return `gitlab:${baseUrl}/${projectPath.toLowerCase()}`;
}

async function createGitlabIntegration({
  projectId,
  baseUrl,
  accessToken,
  tokenType,
  projectPath,
}: {
  projectId: string;
  baseUrl: string;
  accessToken: string | undefined;
  tokenType: GitlabTokenType;
  projectPath: string;
}) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const normalizedBase = parseGitlabBaseUrl(baseUrl);
  const normalizedPath = parseGitlabProjectPath(projectPath);

  // A saved credential is only authorized for its original server. With
  // multiple bindings, reuse the token of any existing binding of this project
  // on the same instance; the unchanged-destination guard below still applies.
  const existingIntegrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "gitlab"),
    ),
  });

  let previousConfig: Partial<GitlabConfig> = {};
  for (const existing of existingIntegrations) {
    try {
      const config = JSON.parse(existing.config) as GitlabConfig;
      let savedBase: string | undefined;
      try {
        savedBase = normalizeGitlabBaseUrl(config.baseUrl ?? "");
      } catch {
        // Invalid legacy destinations cannot authorize credential reuse.
      }
      if (savedBase === normalizedBase && config.accessToken) {
        previousConfig = config;
        break;
      }
    } catch {
      // Skip bindings with invalid config; they cannot authorize reuse.
    }
  }

  const suppliedToken = accessToken?.trim();
  if (!suppliedToken && previousConfig.accessToken) {
    // previousConfig was only selected for a matching base URL, so the
    // saved credential is already known to target the requested instance.
    // A changed URL never reaches here and requires a new token below.
  }
  const resolvedToken = suppliedToken || previousConfig.accessToken || "";

  if (!resolvedToken) {
    throw new HTTPException(400, {
      message: "Access token is required",
    });
  }

  try {
    await verifyGitlabToken(normalizedBase, resolvedToken, tokenType);

    const client = createGitlabClient({
      baseUrl: normalizedBase,
      accessToken: resolvedToken,
      tokenType,
    });
    await client.getProject(normalizedPath);
  } catch (error) {
    if (error instanceof GitlabApiError) {
      throw new HTTPException((error.status || 400) as ContentfulStatusCode, {
        message: error.message,
      });
    }
    throw error;
  }

  // WP10: enforce the per-project repository binding quota after project
  // verification and before the insert. 402 propagates unchanged.
  await assertRepositoryBindingQuota(projectId, project.workspaceId);

  const webhookSecret = randomBytes(24).toString("hex");

  const config: GitlabConfig = {
    ...getDefaultGitlabConfig(
      normalizedBase,
      resolvedToken,
      tokenType,
      normalizedPath,
      webhookSecret,
    ),
  };

  const validation = await validateGitlabConfig(config);
  if (!validation.valid) {
    throw new HTTPException(400, {
      message: validation.errors?.join(", ") ?? "Invalid config",
    });
  }

  // Display-convenience identity columns (RFC WP4 section 2): the final path
  // segment as name, the top-level group as owner; repositoryId stays NULL.
  const pathSegments = normalizedPath.split("/");
  const repositoryName = pathSegments[pathSegments.length - 1] ?? normalizedPath;
  const repositoryOwner = pathSegments[0] ?? "";

  try {
    const [newIntegration] = await db
      .insert(integrationTable)
      .values({
        projectId,
        type: "gitlab",
        config: JSON.stringify(config),
        repositoryKey: gitlabRepositoryKey(normalizedBase, normalizedPath),
        repositoryOwner,
        repositoryName,
        baseUrl: normalizedBase,
        isActive: true,
      })
      .returning();

    if (!newIntegration) {
      throw new HTTPException(500, {
        message: "Failed to create GitLab integration",
      });
    }

    return {
      id: newIntegration.id,
      projectId: newIntegration.projectId,
      baseUrl: normalizedBase,
      projectPath: normalizedPath,
      tokenType,
      webhookSecret,
      isActive: newIntegration.isActive,
      createdAt: newIntegration.createdAt,
      updatedAt: newIntegration.updatedAt,
    };
  } catch (error) {
    mapIntegrationUniqueViolation(error, { projectId, type: "gitlab" });
  }
}

export default createGitlabIntegration;
