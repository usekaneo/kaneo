import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import db from "../../database";
import { integrationTable, projectTable } from "../../database/schema";
import { mapIntegrationUniqueViolation } from "../../integrations/map-unique-violation";
import {
  assertRepositoryBindingQuota,
  withRepositoryBindingQuotaLock,
} from "../../plan-limits/repository-binding-quota";
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

// RFC 0001 WP4: one integration row per GitLab project. Cross-project
// duplicates are valid rows per governing decision D1; same-project
// duplicates are decided by the per-project unique constraint
// (integration_project_type_repo_unique).
//
// Re-linking a project this repository already binds reconciles that row in
// place instead of inserting a second one: the row is snapshotted before the
// verification round trip, and after verification the verified destination is
// merged into the prior config (preserving sync rules, user settings, and
// the webhook secret), the repository identity columns are re-keyed, and the
// row is reactivated. A config that changed during verification (for example
// sync rules saved while the token was being verified) is not silently
// overwritten: the guarded update matches no row and the request fails with
// 409. Existing issue links and the integration id survive a re-verification.

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

/** Parse a stored config, tolerating legacy rows with invalid JSON. */
function parseStoredConfig(raw: string): Partial<GitlabConfig> {
  try {
    return JSON.parse(raw) as Partial<GitlabConfig>;
  } catch {
    return {};
  }
}

/** Normalize a stored base URL, treating an invalid legacy value as absent. */
function storedGitlabBaseUrl(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  try {
    return normalizeGitlabBaseUrl(raw);
  } catch {
    return null;
  }
}

/** Normalize a stored project path, treating an invalid value as absent. */
function storedGitlabProjectPath(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  try {
    return parseGitlabProjectPath(raw);
  } catch {
    return null;
  }
}

type ReconcilableRow = {
  id: string;
  config: string;
  repositoryKey: string | null;
  isActive: boolean | null;
};

/**
 * Pick the same-project row that a re-link reconciles in place. A row keyed
 * with the repository identity key wins; otherwise legacy rows written
 * before the `repositoryKey` column keep their destination inside config
 * JSON only and are matched in memory.
 */
function findReconcilableGitlabRow<T extends ReconcilableRow>(
  rows: T[],
  repositoryKey: string,
  baseUrl: string,
  projectPath: string,
): T | null {
  for (const row of rows) {
    if (row.repositoryKey === repositoryKey) return row;
  }
  for (const row of rows) {
    const stored = parseStoredConfig(row.config);
    if (
      storedGitlabBaseUrl(stored.baseUrl) === baseUrl &&
      (storedGitlabProjectPath(stored.projectPath) ?? "").toLowerCase() ===
        projectPath.toLowerCase()
    ) {
      return row;
    }
  }
  return null;
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

  // Snapshot the reconcilable row before the verification round trip so a
  // concurrent change to its config (for example sync rules saved while the
  // token was being verified) is detected by the guarded update below and
  // rejected with 409 instead of being silently overwritten.
  const repositoryKey = gitlabRepositoryKey(normalizedBase, normalizedPath);
  const snapshot = findReconcilableGitlabRow(
    existingIntegrations,
    repositoryKey,
    normalizedBase,
    normalizedPath,
  );

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
  const repositoryName =
    pathSegments[pathSegments.length - 1] ?? normalizedPath;
  const repositoryOwner = pathSegments[0] ?? "";

  // WP10: the quota guard and the write run in one transaction under the
  // project's advisory lock, so two concurrent creates or reactivations for
  // the same project cannot both pass the quota check. Token verification
  // and config validation above stay outside the transaction because they
  // talk to GitLab over HTTP.
  return withRepositoryBindingQuotaLock(projectId, async (tx) => {
    // Re-link path: the snapshot taken before verification reconciles in
    // place. A second row for this project path in this project cannot exist
    // (the unique constraint forbids it), so insert stays the only other
    // branch.
    if (snapshot) {
      // WP10: reactivating a deactivated row re-enters the binding count,
      // so the quota guard runs before the update writes isActive=true.
      if (!snapshot.isActive) {
        await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);
      }

      // Verified values win over any stale values in the old config; user
      // settings (sync rules, workflow transitions, comment behavior) and
      // the prior webhook secret survive the merge, mirroring the update
      // route's reconnect semantics.
      const reconciledConfig = parseStoredConfig(snapshot.config);
      const mergedConfig = {
        ...getDefaultGitlabConfig(
          normalizedBase,
          resolvedToken,
          tokenType,
          normalizedPath,
          reconciledConfig.webhookSecret ?? webhookSecret,
        ),
        ...reconciledConfig,
        baseUrl: normalizedBase,
        accessToken: resolvedToken,
        tokenType,
        projectPath: normalizedPath,
        webhookSecret: reconciledConfig.webhookSecret ?? webhookSecret,
      };

      try {
        const [reconciled] = await tx
          .update(integrationTable)
          .set({
            config: JSON.stringify(mergedConfig),
            repositoryKey,
            repositoryOwner,
            repositoryName,
            baseUrl: normalizedBase,
            isActive: true,
            updatedAt: new Date(),
          })
          // Optimistic config check against the pre-verification snapshot:
          // if the row changed while the token was being verified, the
          // update matches no row and the caller must refresh.
          .where(
            and(
              eq(integrationTable.id, snapshot.id),
              eq(integrationTable.config, snapshot.config),
            ),
          )
          .returning();

        if (!reconciled) {
          throw new HTTPException(409, {
            message: "GitLab integration changed; refresh before reconnecting",
          });
        }

        return {
          id: reconciled.id,
          projectId: reconciled.projectId,
          baseUrl: normalizedBase,
          projectPath: normalizedPath,
          tokenType,
          webhookSecret: mergedConfig.webhookSecret,
          isActive: reconciled.isActive,
          createdAt: reconciled.createdAt,
          updatedAt: reconciled.updatedAt,
        };
      } catch (error) {
        mapIntegrationUniqueViolation(error, { projectId, type: "gitlab" });
      }
    }

    // WP10: enforce the per-project repository binding quota before the
    // insert. 402 propagates unchanged.
    await assertRepositoryBindingQuota(projectId, project.workspaceId, tx);

    try {
      const [newIntegration] = await tx
        .insert(integrationTable)
        .values({
          projectId,
          type: "gitlab",
          config: JSON.stringify(config),
          repositoryKey,
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
  });
}

export default createGitlabIntegration;
